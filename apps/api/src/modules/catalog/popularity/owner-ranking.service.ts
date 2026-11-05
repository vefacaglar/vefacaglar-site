import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../catalog.tokens";
import type { IGamesRepository } from "../games.repository.interface";
import { IGDB_CLIENT } from "../import/import.tokens";
import type { IIgdbClient } from "../import/import.types";
import { OWNER_RANKING_CONFIG as config } from "./owner-ranking.config";
import { ownerRankingBreakdown } from "./owner-ranking";
import type { GameModeBackfillResult, GameModeCursor, OwnerRankingInspection } from "./owner-ranking.types";

@injectable()
export class OwnerRankingService {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient
  ) {}

  /** Bounded, age-rotated hydration; missing provider rows retain unknown/previous modes; failures retain all state. */
  async backfillGameModes(now = new Date()): Promise<GameModeBackfillResult> {
    const signal = AbortSignal.timeout(config.modeBudgetMs);
    const staleBefore = new Date(now.getTime() - config.modeRefreshDays * 86_400_000);
    let cursor: GameModeCursor | null = null;
    let checkedCount = 0;
    for (let batch = 0; batch < config.modeMaxBatches; batch++) {
      if (signal.aborted) return { checkedCount, status: "budget" };
      const candidates = await this.gamesRepo.listGameModeCandidates(cursor, config.modeBatchSize, staleBefore);
      if (candidates.length === 0) return { checkedCount, status: "complete" };
      const byIgdbId = new Map(candidates.map((candidate) => [candidate.igdbId, candidate.id]));
      let modes: Awaited<ReturnType<IIgdbClient["listGameModes"]>>;
      try {
        modes = await this.igdb.listGameModes([...byIgdbId.keys()], signal);
      } catch {
        return { checkedCount, status: signal.aborted ? "budget" : "unavailable" };
      }
      const modesById = new Map(modes.map((row) => [row.igdbId, row.gameModeIds]));
      const updates = candidates.map((candidate) => ({
        id: candidate.id,
        gameModeIds: modesById.get(candidate.igdbId) ?? null,
      }));
      // Database failures must fail the job, rather than masquerade as provider unavailability.
      await this.gamesRepo.writeGameModes(updates, now);
      checkedCount += modes.length;
      // Missing ids get an attempt timestamp, not empty modes, so later jobs also make progress.
      const last = candidates[candidates.length - 1];
      cursor = { id: last.id, popularityScore: last.popularityScore };
      if (candidates.length < config.modeBatchSize) return { checkedCount, status: "complete" };
    }
    return { checkedCount, status: "budget" };
  }

  async inspect(gameId: string): Promise<OwnerRankingInspection | null> {
    const source = await this.gamesRepo.findOwnerRankingSource(gameId);
    return source ? { source, breakdown: ownerRankingBreakdown(source) } : null;
  }
}
