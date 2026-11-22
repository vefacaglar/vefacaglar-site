import { injectable } from "tsyringe";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { games, gameCompletionReports, gameCompletionProviderState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { CompletionIdentity, CompletionObservation, CompletionProvider, ICompletionSourcesRepository } from "./completion-sources.types";

@injectable()
export class DrizzleCompletionSourcesRepository implements ICompletionSourcesRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async state(provider: string) {
    const [row] = await this.dbProvider.client.select().from(gameCompletionProviderState).where(eq(gameCompletionProviderState.provider, provider));
    return row ?? null;
  }
  async failure(provider: string, code: string, retryAt: Date) {
    await this.dbProvider.client.insert(gameCompletionProviderState).values({ provider, cooldownUntil: retryAt, errorCode: code })
      .onConflictDoUpdate({ target: gameCompletionProviderState.provider, set: { cooldownUntil: retryAt, errorCode: code } });
  }
  async saveMap(identities: CompletionIdentity[], checkedAt: Date) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      await db.insert(gameCompletionProviderState).values({ provider: "identity-map", identityMap: identities, mapCheckedAt: checkedAt })
        .onConflictDoUpdate({ target: gameCompletionProviderState.provider,
          set: { identityMap: identities, mapCheckedAt: checkedAt, cooldownUntil: null, errorCode: null } });
      for (const provider of ["ifdb", "vndb"] as const) {
        const expected = new Map(identities.flatMap((row) => {
          const externalId = provider === "ifdb" ? row.ifdbId : row.vndbId;
          return externalId ? [[row.igdbId, externalId] as const] : [];
        }));
        const old = await db.select({ igdbId: gameCompletionReports.igdbId, externalId: gameCompletionReports.externalId })
          .from(gameCompletionReports).where(eq(gameCompletionReports.provider, provider));
        const invalid = old.filter((row) => expected.get(row.igdbId) !== row.externalId).map((row) => row.igdbId);
        if (invalid.length) {
          await db.update(gameCompletionReports).set({ observedAt: null })
            .where(and(eq(gameCompletionReports.provider, provider), inArray(gameCompletionReports.igdbId, invalid)));
        }
      }
    });
  }
  async catalogSlugs(slugs: string[]) {
    if (!slugs.length) return [];
    const rows = await this.dbProvider.client.select({ igdbId: games.igdbId, slug: games.slug }).from(games)
      .where(and(inArray(games.slug, slugs), isNotNull(games.igdbId)));
    return rows.map((row) => ({ igdbId: row.igdbId!, slug: row.slug }));
  }
  async backloggdCandidates(now: Date): Promise<CompletionIdentity[]> {
    // Rotate the current-interest pool by the last check, with per-source cache
    // deadlines. Negative responses advance the same cursor as positive ones.
    const rows = await this.dbProvider.client.execute(sql`
      with leaders as (
        select igdb_id, slug, popularity_score from games where igdb_id is not null
        order by popularity_score desc nulls last, id limit 512
      )
      select l.igdb_id, l.slug from leaders l left join game_completion_reports r
        on r.igdb_id=l.igdb_id and r.provider='backloggd'
      where r.next_check_at is null or r.next_check_at <= ${now.toISOString()}::timestamptz
      order by r.checked_at asc nulls first, l.popularity_score desc nulls last, l.igdb_id limit 32`);
    return rows.map((row) => ({ igdbId: Number(row.igdb_id), slug: String(row.slug) }));
  }
  async due(provider: CompletionProvider, identities: CompletionIdentity[], now: Date) {
    if (!identities.length) return [];
    const rows = await this.dbProvider.client.select({ igdbId: gameCompletionReports.igdbId, externalId: gameCompletionReports.externalId, nextCheckAt: gameCompletionReports.nextCheckAt })
      .from(gameCompletionReports).where(and(eq(gameCompletionReports.provider, provider), inArray(gameCompletionReports.igdbId, identities.map((row) => row.igdbId))));
    const previous = new Map(rows.map((row) => [row.igdbId, row]));
    return identities.filter((row) => {
      const cached = previous.get(row.igdbId);
      const externalId = provider === "ifdb" ? row.ifdbId : provider === "vndb" ? row.vndbId : row.slug;
      return !cached || cached.externalId !== externalId || cached.nextCheckAt.getTime() <= now.getTime();
    });
  }
  async save(observations: CompletionObservation[], checkedAt: Date) {
    if (!observations.length) return { accepted: 0, added: 0 };
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const provider = observations[0].provider;
      if (observations.some((row) => row.provider !== provider)) throw new Error("Mixed completion provider write");
      const old = await db.select({ igdbId: gameCompletionReports.igdbId, externalId: gameCompletionReports.externalId, observedAt: gameCompletionReports.observedAt })
        .from(gameCompletionReports).where(and(eq(gameCompletionReports.provider, provider), inArray(gameCompletionReports.igdbId, observations.map((row) => row.identity.igdbId))));
      const previousIds = new Map(old.map((row) => [row.igdbId, row.externalId]));
      const existing = new Set(old.filter((row) => row.observedAt).map((row) => row.igdbId));
      let accepted = 0;
      let added = 0;
      for (const observation of observations) {
        const { report, identity } = observation;
        const sourceUrl = report?.sourceUrl ?? (provider === "backloggd" ? `https://backloggd.com/games/${identity.slug}/`
          : provider === "ifdb" ? `https://ifdb.org/viewgame?id=${identity.ifdbId}` : `https://vndb.org/${identity.vndbId}`);
        const values = { igdbId: identity.igdbId, provider, externalId: observation.externalId, sourceUrl,
          scope: report?.scope ?? "No usable observation", statistic: report?.statistic ?? "reported",
          finishSeconds: report?.finishSeconds, masterSeconds: report?.masterSeconds, playtimeSeconds: report?.playtimeSeconds,
          sampleCount: report?.sampleCount, sourceUpdatedAt: report?.sourceUpdatedAt ? new Date(report.sourceUpdatedAt) : null,
          observedAt: report ? new Date(report.fetchedAt) : null, checkedAt, nextCheckAt: observation.nextCheckAt };
        // An empty/negative source response only advances its cache. It never
        // erases a previously accepted measurement or relabels its fetch date.
        const identityChanged = previousIds.has(identity.igdbId) && previousIds.get(identity.igdbId) !== observation.externalId;
        const set = report ? values : observation.invalidate || identityChanged
          ? { checkedAt, nextCheckAt: observation.nextCheckAt, externalId: observation.externalId, sourceUrl,
            observedAt: null, finishSeconds: null, masterSeconds: null, playtimeSeconds: null, sampleCount: null }
          : { checkedAt, nextCheckAt: observation.nextCheckAt };
        await db.insert(gameCompletionReports).values(values).onConflictDoUpdate({
          target: [gameCompletionReports.igdbId, gameCompletionReports.provider], set,
        });
        if (report) { accepted++; if (!existing.has(identity.igdbId)) added++; }
      }
      return { accepted, added };
    });
  }
}
