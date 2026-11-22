import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../catalog.tokens";
import type { IGamesRepository, PopularitySignal } from "../games.repository.interface";
import { IGDB_CLIENT } from "../import/import.tokens";
import type { IIgdbClient } from "../import/import.types";
import { EVENT_BUS } from "../../../shared/events/events.tokens";
import type { IEventBus } from "../../../shared/events/event-bus";
import { gamesImported } from "../catalog.events";
import {
  computePopularityScores,
  isCurrentPopularityObservation,
  POPULARITY_TYPE,
  REFRESHED_POPULARITY_TYPES,
  type PopularityInput,
} from "./popularity-score";
import { PopularityDiscoveryService } from "./popularity-discovery.service";
import { OwnerRankingService } from "./owner-ranking.service";
import { ownerRankingBreakdown } from "./owner-ranking";
import { OWNER_RANKING_CONFIG } from "./owner-ranking.config";
import type { RefreshPopularityResponse } from "./popularity.schema";

const SCORE_EPSILON = 1e-9;

/**
 * Pulls current IGDB interest signals, stores those belonging to the catalog,
 * recomputes each game's trend score and owner-taste recommendation, and
 * reindexes changed games. Strict CLI runs resynchronize all considered games
 * so retrying a failed search write also repairs unchanged scores.
 */
@injectable()
export class RefreshPopularityHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly ownerRanking: OwnerRankingService,
    private readonly discovery: PopularityDiscoveryService
  ) {}

  async handle(options: { requireSearchSync?: boolean } = {}): Promise<RefreshPopularityResponse> {
    const startedAt = Date.now();
    let sources = await this.gamesRepo.listPopularitySources();
    const primitives = await this.igdb.listPopularity(REFRESHED_POPULARITY_TYPES);
    // Deduplicate before discovery and normalization so old calculations cannot inflate leaders.
    const latest = new Map<string, (typeof primitives)[number]>();
    for (const primitive of primitives) {
      if (!REFRESHED_POPULARITY_TYPES.includes(primitive.popularityType) || !Number.isFinite(primitive.value) || primitive.value < 0
        || !isCurrentPopularityObservation(primitive.calculatedAt, startedAt)) continue;
      const key = `${primitive.igdbId}:${primitive.popularityType}`;
      const previous = latest.get(key);
      if (!previous || (previous.calculatedAt?.getTime() ?? 0) <= (primitive.calculatedAt?.getTime() ?? 0)) latest.set(key, primitive);
    }
    if (latest.size === 0) throw new Error("IGDB returned no current popularity data; existing scores were kept");
    const currentPrimitives = [...latest.values()];
    const discoveredCount = await this.discovery.discover(currentPrimitives, new Set(sources.map((source) => source.igdbId)));
    const modes = await this.ownerRanking.backfillGameModes();
    // Discovery and mode hydration must participate in this run's score calculation.
    sources = await this.gamesRepo.listPopularitySources();
    if (sources.length === 0) {
      return { gameCount: 0, discoveredCount, signalCount: 0, scoredCount: 0, reindexedCount: 0, recommendationScoredCount: 0, gameModesCheckedCount: modes.checkedCount, gameModesStatus: modes.status, durationMs: Date.now() - startedAt };
    }
    const gameIdByIgdbId = new Map(sources.map((source) => [source.igdbId, source.id]));
    const signalsByKey = new Map<string, PopularitySignal>();
    for (const primitive of currentPrimitives) {
      const gameId = gameIdByIgdbId.get(primitive.igdbId);
      if (!gameId) continue;
      signalsByKey.set(`${gameId}:${primitive.popularityType}`, {
        gameId, popularityType: primitive.popularityType, value: primitive.value, calculatedAt: primitive.calculatedAt,
      });
    }
    const signals = [...signalsByKey.values()];
    if (signals.length === 0) {
      throw new Error("IGDB returned no current popularity data for this catalog; existing scores were kept");
    }

    // Normalize against the complete provider population, independent of catalog coverage.
    const inputsByIgdbId = new Map<number, PopularityInput>();
    const singlePlayerIds = new Set(sources.filter((source) => source.gameModeIds?.includes(OWNER_RANKING_CONFIG.singlePlayerMode)).map((source) => source.igdbId));
    const signalKeys = new Map<number, "visits" | "playing" | "steam24hPeak">([
      [POPULARITY_TYPE.VISITS, "visits"], [POPULARITY_TYPE.PLAYING, "playing"], [POPULARITY_TYPE.STEAM_24H_PEAK_PLAYERS, "steam24hPeak"],
    ]);
    for (const primitive of currentPrimitives) {
      const input = inputsByIgdbId.get(primitive.igdbId) ?? {
        id: String(primitive.igdbId), singlePlayer: singlePlayerIds.has(primitive.igdbId), signals: {},
      };
      input.signals[signalKeys.get(primitive.popularityType)!] = primitive.value;
      inputsByIgdbId.set(primitive.igdbId, input);
    }
    const scoresByIgdbId = computePopularityScores([...inputsByIgdbId.values()]);
    const scoreById = new Map(sources.map((source) => [source.id, scoresByIgdbId.get(String(source.igdbId)) ?? null]));
    const scores = sources.map((s) => ({ id: s.id, score: scoreById.get(s.id) ?? null }));

    const recommendationScores = sources.map((source) => ({
      id: source.id,
      score: ownerRankingBreakdown({ ...source, popularityScore: scoreById.get(source.id) ?? null }).score,
    }));

    const sourceDateById = new Map<string, Date>();
    for (const signal of signals) {
      const timestamp = signal.calculatedAt!;
      const previous = sourceDateById.get(signal.gameId);
      if (!previous || timestamp < previous) sourceDateById.set(signal.gameId, timestamp);
    }
    await this.gamesRepo.writePopularity({
      popularityTypes: REFRESHED_POPULARITY_TYPES,
      signals,
      scores,
      sourceDates: sources.map((source) => ({ id: source.id, calculatedAt: sourceDateById.get(source.id) ?? null })),
      recommendationScores,
      recommendationVersion: OWNER_RANKING_CONFIG.version,
      updatedAt: new Date(),
    });

    const previous = new Map(sources.map((s) => [s.id, s.popularityScore]));
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const changedIds = options.requireSearchSync
      ? sources.map((source) => source.id)
      : [...new Set([
          ...scores.filter((s) => scoreChanged(previous.get(s.id) ?? null, s.score)).map((s) => s.id),
          ...recommendationScores.filter((score) => scoreChanged(
            sourcesById.get(score.id)?.recommendationScore ?? null, score.score
          )).map((score) => score.id),
        ])];
    // The bulk-change event reindexes the games in batches through the search subscriber.
    await this.eventBus.publish(
      gamesImported(changedIds, { developer: [], publisher: [], genre: [], platform: [], theme: [] }, options.requireSearchSync),
      { throwOnError: options.requireSearchSync }
    );

    return {
      gameCount: sources.length,
      discoveredCount,
      signalCount: signals.length,
      scoredCount: scores.filter((s) => s.score !== null).length,
      reindexedCount: changedIds.length,
      recommendationScoredCount: recommendationScores.length,
      gameModesCheckedCount: modes.checkedCount,
      gameModesStatus: modes.status,
      durationMs: Date.now() - startedAt,
    };
  }
}

function scoreChanged(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return before !== after;
  return Math.abs(before - after) > SCORE_EPSILON;
}
