import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../catalog.tokens";
import type { HltbPopularityUpdate, IGamesRepository, PopularitySignal } from "../games.repository.interface";
import { HLTB_CLIENT, IGDB_CLIENT } from "../import/import.tokens";
import type { IHltbClient, IIgdbClient } from "../import/import.types";
import { matchHltbGames } from "../import/hltb-data";
import { EVENT_BUS } from "../../../shared/events/events.tokens";
import type { IEventBus } from "../../../shared/events/event-bus";
import { gamesImported } from "../catalog.events";
import {
  computePopularityScores,
  POPULARITY_TYPE,
  REFRESHED_POPULARITY_TYPES,
  type PopularityInput,
} from "./popularity-score";
import type { RefreshPopularityResponse } from "./popularity.schema";

const SCORE_EPSILON = 1e-9;

/**
 * Pulls current IGDB interest signals, stores those belonging to the catalog,
 * supplements HLTB data separately, and recomputes each game's trend score
 * and reindexes changed games. Strict CLI runs resynchronize all considered
 * games so retrying a failed search write also repairs unchanged scores.
 */
@injectable()
export class RefreshPopularityHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @inject(HLTB_CLIENT) private readonly hltb: IHltbClient
  ) {}

  async handle(options: { requireSearchSync?: boolean } = {}): Promise<RefreshPopularityResponse> {
    const startedAt = Date.now();
    const sources = await this.gamesRepo.listPopularitySources();
    if (sources.length === 0) {
      return { gameCount: 0, signalCount: 0, scoredCount: 0, reindexedCount: 0, hltbStatus: "updated", hltbFetchedCount: 0, hltbMatchedCount: 0, durationMs: Date.now() - startedAt };
    }
    const gameIdByIgdbId = new Map(sources.map((s) => [s.igdbId, s.id]));

    const primitives = await this.igdb.listPopularity(REFRESHED_POPULARITY_TYPES);

    // One row per game and type; if IGDB ever returns several, the latest calculation wins.
    const signalsByKey = new Map<string, PopularitySignal>();
    for (const p of primitives) {
      const gameId = gameIdByIgdbId.get(p.igdbId);
      if (!gameId || !REFRESHED_POPULARITY_TYPES.includes(p.popularityType) || !Number.isFinite(p.value) || p.value < 0) continue;
      const key = `${gameId}:${p.popularityType}`;
      const current = signalsByKey.get(key);
      if (current && (current.calculatedAt?.getTime() ?? 0) > (p.calculatedAt?.getTime() ?? 0)) continue;
      signalsByKey.set(key, { gameId, popularityType: p.popularityType, value: p.value, calculatedAt: p.calculatedAt });
    }
    const signals = [...signalsByKey.values()];
    if (signals.length === 0) {
      throw new Error("IGDB returned no current popularity data for this catalog; existing scores were kept");
    }

    const hltbUpdates: HltbPopularityUpdate[] = [];
    let hltbStatus: RefreshPopularityResponse["hltbStatus"] = "updated";
    let hltbFetchedCount = 0;
    if (sources.length > 0) {
      try {
        const entries = await this.hltb.listPopular();
        hltbFetchedCount = entries.length;
        const sourceById = new Map(sources.map((source) => [source.id, source]));
        for (const [gameId, entry] of matchHltbGames(sources, entries)) {
          const previous = sourceById.get(gameId)!.hltb;
          // Missing fields on a changed provider response never erase a last good count.
          hltbUpdates.push({
            gameId, hltbId: entry.hltbId,
            completed: entry.completed ?? previous?.completed ?? null,
            backlog: entry.backlog ?? previous?.backlog ?? null,
            playing: entry.playing ?? previous?.playing ?? null,
            updatedAt: [entry.completed, entry.backlog, entry.playing].some((count) => count !== null)
              ? new Date() : previous?.updatedAt ?? new Date(),
            times: entry.times,
          });
        }
      } catch {
        // Optional website data must not block IGDB or expose public session tokens in errors.
        hltbStatus = "unavailable";
      }
    }
    const valueOf = (gameId: string, type: number) => signalsByKey.get(`${gameId}:${type}`)?.value ?? null;
    const inputs: PopularityInput[] = sources.map((s) => ({
      id: s.id,
      signals: {
        visits: valueOf(s.id, POPULARITY_TYPE.VISITS),
        playing: valueOf(s.id, POPULARITY_TYPE.PLAYING),
        steam24hPeak: valueOf(s.id, POPULARITY_TYPE.STEAM_24H_PEAK_PLAYERS),
      },
    }));
    const scoreById = computePopularityScores(inputs);
    const scores = sources.map((s) => ({ id: s.id, score: scoreById.get(s.id) ?? null }));

    await this.gamesRepo.writePopularity({
      popularityTypes: REFRESHED_POPULARITY_TYPES,
      signals,
      scores,
      hltbUpdates,
      updatedAt: new Date(),
    });

    const previous = new Map(sources.map((s) => [s.id, s.popularityScore]));
    const changedIds = options.requireSearchSync
      ? sources.map((source) => source.id)
      : [...new Set([
          ...scores.filter((s) => scoreChanged(previous.get(s.id) ?? null, s.score)).map((s) => s.id),
          ...hltbUpdates.map((update) => update.gameId),
        ])];
    // The bulk-change event reindexes the games in batches through the search subscriber.
    await this.eventBus.publish(
      gamesImported(changedIds, { developer: [], publisher: [], genre: [], platform: [], theme: [] }, options.requireSearchSync),
      { throwOnError: options.requireSearchSync }
    );

    return {
      gameCount: sources.length,
      signalCount: signals.length,
      scoredCount: scores.filter((s) => s.score !== null).length,
      reindexedCount: changedIds.length,
      hltbStatus,
      hltbFetchedCount,
      hltbMatchedCount: hltbUpdates.length,
      durationMs: Date.now() - startedAt,
    };
  }
}

function scoreChanged(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return before !== after;
  return Math.abs(before - after) > SCORE_EPSILON;
}
