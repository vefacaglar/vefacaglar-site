import { randomUUID } from "node:crypto";
import { inject, injectable } from "tsyringe";
import { and, eq, or, sql } from "drizzle-orm";
import { games, gameHltbPopularity, gameHltbLookups, hltbProviderState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { ConflictError, NotFoundError } from "../../../shared/http-errors";
import { assertReceipt, mergeHours } from "./hltb-policy";
import type { ApplyInput, HltbGame, IHltbLookupsRepository, LookupReceipt } from "./hltb.types";
import type { HltbPopularityGame } from "../import/import.types";

@injectable()
export class DrizzleHltbLookupsRepository implements IHltbLookupsRepository {
  constructor(@inject(DbProvider) private readonly dbProvider: DbProvider) {}

  private async readGame(idOrSlug: string, lock = false): Promise<HltbGame | null> {
    const predicate = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(idOrSlug) ? or(eq(games.id, idOrSlug), eq(games.slug, idOrSlug)) : eq(games.slug, idOrSlug);
    const query = this.dbProvider.client.select({ id: games.id, title: games.title, releaseDate: games.releaseDate,
      main: games.hltbMainHours, extra: games.hltbMainExtraHours, completionist: games.hltbCompletionistHours,
      hltbId: gameHltbPopularity.hltbId, mappingSource: gameHltbPopularity.mappingSource,
    }).from(games).leftJoin(gameHltbPopularity, eq(gameHltbPopularity.gameId, games.id)).where(predicate).limit(1).$dynamic();
    const [row] = await (lock ? query.for("update", { of: games }) : query);
    return row ? { id: row.id, title: row.title, releaseYear: row.releaseDate ? Number(row.releaseDate.slice(0, 4)) : null,
      hltbId: row.hltbId, mappingSource: row.mappingSource,
      times: { mainHours: row.main === null ? null : Number(row.main), mainExtraHours: row.extra === null ? null : Number(row.extra), completionistHours: row.completionist === null ? null : Number(row.completionist) } } : null;
  }
  getGame(idOrSlug: string): Promise<HltbGame | null> { return this.readGame(idOrSlug); }

  async getReceipt(gameId: string): Promise<LookupReceipt | null> {
    const [row] = await this.dbProvider.client.select().from(gameHltbLookups).where(eq(gameHltbLookups.gameId, gameId)).limit(1);
    return row ? row as LookupReceipt : null;
  }
  async saveReceipt(receipt: LookupReceipt): Promise<void> {
    const { pendingSearchSync, syncVersion, ...search } = receipt;
    await this.dbProvider.client.insert(gameHltbLookups).values({ ...search, pendingSearchSync, syncVersion }).onConflictDoUpdate({ target: gameHltbLookups.gameId, set: search });
  }
  async apply(gameId: string, receipt: LookupReceipt, candidate: HltbPopularityGame, input: ApplyInput) {
    try {
      return await this.dbProvider.transaction(async () => {
        await this.dbProvider.client.execute(sql`set local lock_timeout = '5s'`);
        // Shared with the background writer: serialize ownership checks for this external ID.
        await this.dbProvider.client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hltb:mapping:${candidate.hltbId}`}, 0))`);
        const game = await this.readGame(gameId, true);
        if (!game) throw new NotFoundError("err_hltb_game_not_found");
        const [stored] = await this.dbProvider.client.select().from(gameHltbLookups).where(eq(gameHltbLookups.gameId, gameId)).for("update");
        assertReceipt(game, stored ? stored as LookupReceipt : null, input);
        if (stored.receiptId !== receipt.receiptId) throw new ConflictError("err_hltb_receipt_expired");
        const [owner] = await this.dbProvider.client.select({ gameId: gameHltbPopularity.gameId }).from(gameHltbPopularity).where(eq(gameHltbPopularity.hltbId, candidate.hltbId));
        if (owner && owner.gameId !== game.id) throw new ConflictError("err_hltb_mapping_owned");
        const times = mergeHours(game.times, candidate.times, input.overwriteFields);
        const now = new Date();
        await this.dbProvider.client.insert(gameHltbPopularity).values({ gameId, hltbId: candidate.hltbId, mappingSource: "manual", mappingVerifiedAt: now, updatedAt: null })
          .onConflictDoUpdate({ target: gameHltbPopularity.gameId, set: {
            hltbId: candidate.hltbId, mappingSource: "manual", mappingVerifiedAt: now,
            // A remap invalidates the old game's engagement; a lookup did not fetch fresh counts.
            completed: sql`case when ${gameHltbPopularity.hltbId} = ${candidate.hltbId} then ${gameHltbPopularity.completed} else null end`,
            backlog: sql`case when ${gameHltbPopularity.hltbId} = ${candidate.hltbId} then ${gameHltbPopularity.backlog} else null end`,
            playing: sql`case when ${gameHltbPopularity.hltbId} = ${candidate.hltbId} then ${gameHltbPopularity.playing} else null end`,
            updatedAt: sql`case when ${gameHltbPopularity.hltbId} = ${candidate.hltbId} then ${gameHltbPopularity.updatedAt} else null end`,
          } });
        await this.dbProvider.client.update(games).set({ hltbMainHours: times.mainHours?.toString() ?? null, hltbMainExtraHours: times.mainExtraHours?.toString() ?? null,
          hltbCompletionistHours: times.completionistHours?.toString() ?? null, updatedAt: now }).where(eq(games.id, gameId));
        const syncVersion = randomUUID();
        await this.dbProvider.client.update(gameHltbLookups).set({ pendingSearchSync: true, syncVersion, expiresAt: now }).where(eq(gameHltbLookups.gameId, gameId));
        return { game: { ...game, hltbId: candidate.hltbId, mappingSource: "manual", times }, syncVersion };
      });
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") throw new ConflictError("err_hltb_mapping_owned");
      if (code === "55P03" || code === "40P01") throw new ConflictError("err_hltb_busy");
      throw error;
    }
  }
  async withSearchSync<T>(gameId: string, work: () => Promise<T>): Promise<T> {
    return this.dbProvider.transaction(async () => {
      await this.dbProvider.client.execute(sql`set local lock_timeout = '5s'`);
      // Hold across read/import/conditional-clear so another process cannot import an
      // older snapshot after the newer application has already cleared its pending flag.
      await this.dbProvider.client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hltb:search:${gameId}`}, 0))`);
      return work();
    });
  }
  async clearPendingSync(gameId: string, syncVersion: string): Promise<void> {
    await this.dbProvider.client.update(gameHltbLookups).set({ pendingSearchSync: false }).where(and(eq(gameHltbLookups.gameId, gameId), eq(gameHltbLookups.syncVersion, syncVersion)));
  }
  async deferProvider(until: Date): Promise<void> {
    await this.dbProvider.client.insert(hltbProviderState).values({ id: "hltb", nextRequestAt: new Date(0), cooldownUntil: until })
      .onConflictDoUpdate({ target: hltbProviderState.id, set: { cooldownUntil: sql`greatest(coalesce(${hltbProviderState.cooldownUntil}, ${until.toISOString()}::timestamptz), ${until.toISOString()}::timestamptz)` } });
  }
  async acquireProviderPermit(owner: string): Promise<{ acquired: boolean; retryAt: Date }> {
    await this.dbProvider.client.insert(hltbProviderState).values({ id: "hltb", nextRequestAt: new Date(0) }).onConflictDoNothing();
    const rows = await this.dbProvider.client.execute(sql`
      update ${hltbProviderState} set lease_owner = ${owner}::uuid,
        lease_until = clock_timestamp() + interval '15 seconds', next_request_at = clock_timestamp() + interval '500 milliseconds'
      where id = 'hltb' and (lease_until is null or lease_until <= clock_timestamp())
        and (cooldown_until is null or cooldown_until <= clock_timestamp()) and next_request_at <= clock_timestamp()
      returning id`);
    if (rows.length) return { acquired: true, retryAt: new Date() };
    const [state] = await this.dbProvider.client.select().from(hltbProviderState).where(eq(hltbProviderState.id, "hltb"));
    return { acquired: false, retryAt: new Date(Math.max(Date.now() + 100, state.nextRequestAt.getTime(), state.cooldownUntil?.getTime() ?? 0, state.leaseUntil?.getTime() ?? 0)) };
  }
  async releaseProviderPermit(owner: string, cooldownUntil: Date | null): Promise<void> {
    await this.dbProvider.client.update(hltbProviderState).set({ leaseOwner: null, leaseUntil: null,
      cooldownUntil: cooldownUntil ? sql`greatest(coalesce(${hltbProviderState.cooldownUntil}, ${cooldownUntil.toISOString()}::timestamptz), ${cooldownUntil.toISOString()}::timestamptz)` : sql`${hltbProviderState.cooldownUntil}`,
    }).where(and(eq(hltbProviderState.id, "hltb"), eq(hltbProviderState.leaseOwner, owner)));
  }
}
