import { randomUUID } from "node:crypto";
import { inject, injectable } from "tsyringe";
import { BadRequestError, ConflictError, NotFoundError } from "../../../shared/http-errors";
import { SEARCH_WRITER } from "../../../shared/search/search.tokens";
import type { ISearchIndexWriter } from "../../../shared/search/commands/search-writer.interface";
import { HLTB_CLIENT } from "../import/import.tokens";
import type { IHltbClient } from "../import/import.types";
import { assertReceipt, candidateDto, gameVersion, requiresMismatchAcknowledgement } from "./hltb-policy";
import { HLTB_LOOKUPS_REPOSITORY, HltbProviderUnavailable, type ApplyInput, type ApplyResult, type HltbGame, type IHltbLookupsRepository, type LookupReceipt, type LookupResult } from "./hltb.types";

@injectable()
export class HltbLookupService {
  constructor(
    @inject(HLTB_LOOKUPS_REPOSITORY) private readonly repo: IHltbLookupsRepository,
    @inject(HLTB_CLIENT) private readonly source: IHltbClient,
    @inject(SEARCH_WRITER) private readonly search: ISearchIndexWriter,
  ) {}
  private async game(id: string): Promise<HltbGame> {
    const game = await this.repo.getGame(id);
    if (!game) throw new NotFoundError("err_hltb_game_not_found");
    return game;
  }
  async lookup(id: string, options: { query?: string; refresh?: boolean } = {}): Promise<LookupResult> {
    const game = await this.game(id);
    const query = (options.query ?? game.title).trim().replace(/\s+/g, " ");
    if (!query || query.length > 250) throw new BadRequestError("err_hltb_query_invalid");
    const now = new Date();
    const previous = await this.repo.getReceipt(game.id);
    const version = gameVersion(game);
    // Force refresh never bypasses provider failure backoff or the global request permit.
    if (previous?.query === query && previous.expiresAt > now && (!options.refresh || previous.outcome === "provider_unavailable")) {
      const receipt = previous.expectedVersion === version ? previous : { ...previous, receiptId: randomUUID(), expectedVersion: version };
      if (receipt !== previous) await this.repo.saveReceipt(receipt);
      return this.result(game, receipt, true);
    }
    const receipt: LookupReceipt = {
      gameId: game.id, receiptId: randomUUID(), query, expectedVersion: version,
      candidates: [], outcome: "no_match", checkedAt: now, expiresAt: new Date(now.getTime() + 15 * 60_000),
      retryAfter: null, failureCount: 0, pendingSearchSync: previous?.pendingSearchSync ?? false, syncVersion: previous?.syncVersion ?? null,
    };
    try {
      receipt.candidates = (await this.source.searchCandidates(query)).slice(0, 20);
      receipt.outcome = receipt.candidates.length ? "matches" : "no_match";
      if (!receipt.candidates.length) receipt.expiresAt = new Date(now.getTime() + 60 * 60_000);
    } catch (error) {
      receipt.outcome = "provider_unavailable";
      receipt.failureCount = Math.min(10, (previous?.failureCount ?? 0) + 1);
      receipt.retryAfter = error instanceof HltbProviderUnavailable ? error.retryAt : new Date(Date.now() + Math.min(300_000, 30_000 * 2 ** receipt.failureCount));
      receipt.expiresAt = receipt.retryAfter;
    }
    await this.repo.saveReceipt(receipt);
    return this.result(game, receipt, false);
  }
  async apply(id: string, input: ApplyInput): Promise<ApplyResult> {
    const game = await this.game(id);
    const receipt = await this.repo.getReceipt(game.id);
    assertReceipt(game, receipt, input);
    let current;
    try { current = await this.source.searchCandidates(receipt.query); }
    catch { throw new ConflictError("err_hltb_provider_unavailable"); }
    const fresh = current.find((candidate) => candidate.hltbId === input.hltbId);
    const saved = receipt.candidates.find((candidate) => candidate.hltbId === input.hltbId)!;
    if (!fresh || fresh.title !== saved.title || fresh.releaseYear !== saved.releaseYear) throw new ConflictError("err_hltb_candidate_changed");
    if (requiresMismatchAcknowledgement(game, fresh) && !input.acknowledgeMismatch) throw new ConflictError("err_hltb_mismatch_required");
    const result = await this.repo.apply(game.id, receipt, fresh, input);
    const synced = await this.sync(game.id, result.syncVersion);
    return { game: result.game, searchSync: synced ? "synced" : "pending" };
  }
  async retrySync(id: string): Promise<ApplyResult> {
    const game = await this.game(id);
    const receipt = await this.repo.getReceipt(game.id);
    if (!receipt?.pendingSearchSync || !receipt.syncVersion) return { game, searchSync: "synced" };
    const synced = await this.sync(game.id, receipt.syncVersion);
    return { game, searchSync: synced ? "synced" : "pending" };
  }
  private async sync(gameId: string, version: string): Promise<boolean> {
    try {
      return await this.repo.withSearchSync(gameId, async () => {
        await this.search.indexGames([gameId], { throwOnError: true });
        await this.repo.clearPendingSync(gameId, version);
        return true;
      });
    } catch { return false; }
  }
  private result(game: HltbGame, receipt: LookupReceipt, cached: boolean): LookupResult {
    return { game, expectedVersion: receipt.expectedVersion, receiptId: receipt.receiptId, query: receipt.query,
      outcome: receipt.outcome, candidates: receipt.candidates.map((candidate) => candidateDto(game, candidate)),
      expiresAt: receipt.expiresAt.toISOString(), retryAfter: receipt.retryAfter?.toISOString() ?? null, cached, pendingSearchSync: receipt.pendingSearchSync };
  }
}
