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
  POPULARITY_TYPE,
  REFRESHED_POPULARITY_TYPES,
  type PopularityInput,
} from "./popularity-score";
import type { RefreshPopularityResponse } from "./popularity.schema";

const SCORE_EPSILON = 1e-9;

/**
 * Pulls IGDB popularity primitives for every IGDB-linked game, stores them,
 * recomputes each game's blended popularity score and reindexes the games
 * whose score changed.
 */
@injectable()
export class RefreshPopularityHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async handle(): Promise<RefreshPopularityResponse> {
    const startedAt = Date.now();
    const sources = await this.gamesRepo.listPopularitySources();
    const gameIdByIgdbId = new Map(sources.map((s) => [s.igdbId, s.id]));

    const primitives = await this.igdb.listPopularity([...gameIdByIgdbId.keys()], REFRESHED_POPULARITY_TYPES);

    // One row per game and type; if IGDB ever returns several, the latest calculation wins.
    const signalsByKey = new Map<string, PopularitySignal>();
    for (const p of primitives) {
      const gameId = gameIdByIgdbId.get(p.igdbId);
      if (!gameId || !Number.isFinite(p.value)) continue;
      const key = `${gameId}:${p.popularityType}`;
      const current = signalsByKey.get(key);
      if (current && (current.calculatedAt?.getTime() ?? 0) > (p.calculatedAt?.getTime() ?? 0)) continue;
      signalsByKey.set(key, { gameId, popularityType: p.popularityType, value: p.value, calculatedAt: p.calculatedAt });
    }
    const signals = [...signalsByKey.values()];

    const valueOf = (gameId: string, type: number) => signalsByKey.get(`${gameId}:${type}`)?.value ?? null;
    const inputs: PopularityInput[] = sources.map((s) => ({
      id: s.id,
      signals: {
        played: valueOf(s.id, POPULARITY_TYPE.PLAYED),
        steamReviews: valueOf(s.id, POPULARITY_TYPE.STEAM_TOTAL_REVIEWS),
        wantToPlay: valueOf(s.id, POPULARITY_TYPE.WANT_TO_PLAY),
        ratingCount: s.igdbRatingCount,
      },
    }));
    const scoreById = computePopularityScores(inputs);
    const scores = sources.map((s) => ({ id: s.id, score: scoreById.get(s.id) ?? null }));

    await this.gamesRepo.writePopularity({
      popularityTypes: REFRESHED_POPULARITY_TYPES,
      signals,
      scores,
      updatedAt: new Date(),
    });

    const previous = new Map(sources.map((s) => [s.id, s.popularityScore]));
    const changedIds = scores.filter((s) => scoreChanged(previous.get(s.id) ?? null, s.score)).map((s) => s.id);
    // The bulk-change event reindexes the games in batches through the search subscriber.
    await this.eventBus.publish(
      gamesImported(changedIds, { developer: [], publisher: [], genre: [], platform: [], theme: [] })
    );

    return {
      gameCount: sources.length,
      signalCount: signals.length,
      scoredCount: scores.filter((s) => s.score !== null).length,
      reindexedCount: changedIds.length,
      durationMs: Date.now() - startedAt,
    };
  }
}

function scoreChanged(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return before !== after;
  return Math.abs(before - after) > SCORE_EPSILON;
}
