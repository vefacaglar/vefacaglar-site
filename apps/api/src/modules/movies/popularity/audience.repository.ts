import { isDeepStrictEqual } from "node:util";
import { injectable } from "tsyringe";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { movies, movieAudienceIdentities, movieAudienceSources, moviePopularityState, movieSearchState, movieSourceState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { MOVIE_SOURCE_ID } from "../import/movie-source.types";
import { isQid } from "../import/wikidata-normalizer";
import { MOVIE_INTEREST_SOURCE_URL, MOVIE_POPULARITY_SOURCE_ID } from "./popularity.types";
import { audienceSourceFresh, audienceSummary, dateAfter, rankAudienceItems } from "./audience-ranking";
import { utcDay } from "./wikipedia-interest";
import { AUDIENCE_PROVIDERS, MOVIE_AUDIENCE_SOURCE_ID, type AudienceIdentity, type AudienceProvider, type AudienceScore, type AudienceSnapshot, type AudienceSourceState, type IMovieAudienceRepository } from "./audience.types";

@injectable()
export class DrizzleMovieAudienceRepository implements IMovieAudienceRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async sources(): Promise<AudienceSourceState[]> {
    await this.dbProvider.client.insert(movieAudienceSources).values(AUDIENCE_PROVIDERS.map((provider) => ({ provider }))).onConflictDoNothing();
    const rows = await this.dbProvider.client.select().from(movieAudienceSources).where(inArray(movieAudienceSources.provider, [...AUDIENCE_PROVIDERS]));
    return rows.sort((a, b) => AUDIENCE_PROVIDERS.indexOf(a.provider as AudienceProvider) - AUDIENCE_PROVIDERS.indexOf(b.provider as AudienceProvider)).map((row) => ({ provider: row.provider as AudienceProvider, snapshot: row.snapshot as AudienceSnapshot | null,
      cooldownUntil: row.cooldownUntil, errorCode: row.errorCode }));
  }
  identities(provider: "tmdb" | "netflix", externalIds: string[], after: Date): Promise<AudienceIdentity[]> {
    if (!externalIds.length) return Promise.resolve([]);
    return this.dbProvider.client.select().from(movieAudienceIdentities).where(and(eq(movieAudienceIdentities.provider, provider),
      inArray(movieAudienceIdentities.externalId, externalIds), sql`${movieAudienceIdentities.checkedAt} >= ${after.toISOString()}::timestamptz`)) as Promise<AudienceIdentity[]>;
  }
  async saveIdentities(identities: AudienceIdentity[]) {
    if (!identities.length) return;
    await this.dbProvider.client.insert(movieAudienceIdentities).values(identities).onConflictDoUpdate({
      target: [movieAudienceIdentities.provider, movieAudienceIdentities.externalId],
      set: { wikidataId: sql`excluded.wikidata_id`, checkedAt: sql`excluded.checked_at` },
    });
  }
  async accept(snapshot: AudienceSnapshot) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      await db.insert(movieAudienceSources).values({ provider: snapshot.provider }).onConflictDoNothing();
      const [current] = await db.select().from(movieAudienceSources).where(eq(movieAudienceSources.provider, snapshot.provider)).for("update");
      const previous = current.snapshot as AudienceSnapshot | null;
      if (previous && previous.sourceDate > snapshot.sourceDate) return;
      await db.update(movieAudienceSources).set({ snapshot, acceptedAt: new Date(), lastAttemptAt: new Date(),
        cooldownUntil: null, errorCode: null, failureCount: 0 }).where(eq(movieAudienceSources.provider, snapshot.provider));
    });
  }
  async failure(provider: AudienceProvider, code: string, retryAt: Date) {
    await this.dbProvider.client.insert(movieAudienceSources).values({ provider, lastAttemptAt: new Date(), cooldownUntil: retryAt,
      errorCode: code.replace(/[^a-z0-9_-]/gi, "").slice(0, 80), failureCount: 1 }).onConflictDoUpdate({ target: movieAudienceSources.provider,
      set: { lastAttemptAt: new Date(), errorCode: code.replace(/[^a-z0-9_-]/gi, "").slice(0, 80), failureCount: sql`${movieAudienceSources.failureCount}+1`,
        cooldownUntil: sql`greatest(${movieAudienceSources.cooldownUntil},${retryAt.toISOString()}::timestamptz)` } });
  }
  async wikidataCooldown() {
    const [state] = await this.dbProvider.client.select({ until: movieSourceState.cooldownUntil }).from(movieSourceState).where(eq(movieSourceState.id, MOVIE_SOURCE_ID));
    return state?.until ?? null;
  }
  async deferWikidata(retryAt: Date) {
    await this.dbProvider.client.insert(movieSourceState).values({ id: MOVIE_SOURCE_ID, cooldownUntil: retryAt }).onConflictDoUpdate({ target: movieSourceState.id,
      set: { cooldownUntil: sql`greatest(${movieSourceState.cooldownUntil},${retryAt.toISOString()}::timestamptz)`, updatedAt: new Date() } });
  }
  async wikipedia(): Promise<AudienceSnapshot | null> {
    const [state] = await this.dbProvider.client.select().from(moviePopularityState).where(eq(moviePopularityState.id, MOVIE_POPULARITY_SOURCE_ID));
    if (!state?.sourceDate) return null;
    const rows = await this.dbProvider.client.select({ wikidataId: movies.wikidataId, title: movies.title, views: movies.wikipediaViews }).from(movies)
      .where(and(eq(movies.wikipediaSourceDate, state.sourceDate), isNotNull(movies.wikipediaViews)));
    return { provider: "wikipedia", sourceDate: state.sourceDate, windowStart: dateAfter(state.sourceDate, -2).slice(0, 10),
      expiresAt: dateAfter(state.sourceDate, 8), sourceUrl: MOVIE_INTEREST_SOURCE_URL,
      items: rankAudienceItems(rows.map((row) => ({ externalId: row.wikidataId, wikidataId: row.wikidataId, title: row.title ?? row.wikidataId, value: row.views! }))) };
  }
  async publish(snapshots: AudienceSnapshot[], scores: AudienceScore[], now: Date) {
    if (!snapshots.some((source) => source.provider !== "wikipedia" && audienceSourceFresh(source, now) && source.items.some((item) => !!item.wikidataId)) || !scores.length) {
      return { status: "unchanged" as const, observedMovieCount: 0 };
    }
    if (scores.length > 600 || scores.some((row) => !isQid(row.wikidataId) || !Number.isInteger(row.score) || row.score < 0 || row.score > 1_000_000
      || !Number.isInteger(row.sourceMask) || row.sourceMask < 1 || row.sourceMask > 7)
      || new Set(scores.map((row) => row.wikidataId)).size !== scores.length) throw new Error("invalid_movie_audience_projection");
    const day = utcDay(now);
    const sourceDetails = snapshots.map(audienceSummary);
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      await db.insert(moviePopularityState).values({ id: MOVIE_AUDIENCE_SOURCE_ID }).onConflictDoNothing();
      const [state] = await db.select().from(moviePopularityState).where(eq(moviePopularityState.id, MOVIE_AUDIENCE_SOURCE_ID)).for("update");
      if (state.sourceDate && state.sourceDate > day) throw new Error("stale_movie_audience_projection");
      const providerRows = await db.select().from(movieAudienceSources).where(inArray(movieAudienceSources.provider, [...AUDIENCE_PROVIDERS]))
        .orderBy(movieAudienceSources.provider).for("update");
      const captured = providerRows.flatMap((row) => {
        const snapshot = row.snapshot as AudienceSnapshot | null;
        return snapshot && audienceSourceFresh(snapshot, new Date()) ? [snapshot] : [];
      }).sort((a, b) => AUDIENCE_PROVIDERS.indexOf(a.provider) - AUDIENCE_PROVIDERS.indexOf(b.provider));
      if (!isDeepStrictEqual(captured, snapshots)) throw new Error("movie_audience_sources_changed");
      const previous = await db.select({ wikidataId: movies.wikidataId, score: movies.popularityScore, sourceMask: movies.popularitySourceMask }).from(movies).where(isNotNull(movies.popularityScore));
      const ordered = (rows: { wikidataId: string; score: number | null; sourceMask: number | null }[]) => [...rows].sort((a, b) => a.wikidataId.localeCompare(b.wikidataId));
      if (state.sourceDate === day && isDeepStrictEqual(state.sourceDetails, sourceDetails)
        && isDeepStrictEqual(ordered(previous), ordered(scores))) return { status: "unchanged" as const, observedMovieCount: previous.length };
      // Invalidate the small ranking generation; the index contract is unchanged.
      await db.insert(movieSearchState).values({ id: "movies_en", rankingGeneration: 1 }).onConflictDoUpdate({ target: movieSearchState.id,
        set: { rankingGeneration: sql`${movieSearchState.rankingGeneration}+1`, rankingReady: false, updatedAt: now } });
      const qids = scores.map((row) => row.wikidataId);
      await db.insert(movies).values(qids.map((wikidataId) => ({ wikidataId, slug: `film-${wikidataId.toLowerCase()}` }))).onConflictDoNothing({ target: movies.wikidataId });
      const affected = await db.select({ id: movies.id }).from(movies).where(or(isNotNull(movies.popularityScore), isNotNull(movies.wikipediaViews), inArray(movies.wikidataId, qids)));
      await db.update(movies).set({ popularityScore: null, popularitySourceDate: null, popularitySourceMask: null }).where(or(isNotNull(movies.popularityScore), isNotNull(movies.popularitySourceDate)));
      const values = sql.join(scores.map((row) => sql`(${row.wikidataId}::text,${row.score}::integer,${row.sourceMask}::integer)`), sql`, `);
      const written = await db.execute(sql`update ${movies} set popularity_score=v.score,popularity_source_date=${day}::date,popularity_source_mask=v.mask
        from (values ${values}) v(qid,score,mask) where ${movies.wikidataId}=v.qid and (${movies.hydratedAt} is null or ${movies.isFilm}=true) returning ${movies.id}`);
      if (affected.length) {
        const ids = sql.join(affected.map((row) => sql`(${row.id}::uuid)`), sql`, `);
        await db.execute(sql`insert into movie_search_sync(movie_id) values ${ids} on conflict(movie_id)
          do update set requested_revision=movie_search_sync.requested_revision+1,dirty_at=now()`);
      }
      await db.update(moviePopularityState).set({ sourceDate: day, sourceDetails, observedMovieCount: written.length, publishedAt: now,
        lastAttemptAt: now, failureCount: 0, errorCode: null }).where(eq(moviePopularityState.id, MOVIE_AUDIENCE_SOURCE_ID));
      return { status: "published" as const, observedMovieCount: written.length };
    });
  }
}
