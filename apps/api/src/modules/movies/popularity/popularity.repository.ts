import { injectable } from "tsyringe";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { movies, moviePopularityState, movieSourceState, movieSearchState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { MOVIE_SOURCE_ID } from "../import/movie-source.types";
import { assertCompleteProjection, snapshotDisposition } from "./wikipedia-interest";
import { MOVIE_POPULARITY_SOURCE_ID, type IMoviePopularityRepository, type InterestProjection, type MoviePopularityState } from "./popularity.types";
@injectable()
export class DrizzleMoviePopularityRepository implements IMoviePopularityRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state(): Promise<MoviePopularityState> {
    await this.dbProvider.client.insert(moviePopularityState).values({ id: MOVIE_POPULARITY_SOURCE_ID }).onConflictDoNothing();
    const [state] = await this.dbProvider.client.select().from(moviePopularityState).where(eq(moviePopularityState.id, MOVIE_POPULARITY_SOURCE_ID));
    return state;
  }
  async wikidataCooldown(): Promise<Date | null> {
    const [state] = await this.dbProvider.client.select({ cooldown: movieSourceState.cooldownUntil }).from(movieSourceState).where(eq(movieSourceState.id, MOVIE_SOURCE_ID));
    return state?.cooldown ?? null;
  }
  async recordFailure(code: string, provider: "aqs" | "wikidata", retryAt: Date): Promise<void> {
    await this.dbProvider.transaction(async () => {
      await this.state();
      await this.dbProvider.client.update(moviePopularityState).set({ errorCode: code.replace(/[^a-z0-9_-]/gi, "").slice(0, 80), failureCount: sql`${moviePopularityState.failureCount}+1`, lastAttemptAt: new Date(),
        ...(provider === "aqs" ? { cooldownUntil: sql`greatest(coalesce(${moviePopularityState.cooldownUntil}, ${retryAt.toISOString()}::timestamptz), ${retryAt.toISOString()}::timestamptz)` } : {}),
      }).where(eq(moviePopularityState.id, MOVIE_POPULARITY_SOURCE_ID));
      if (provider === "wikidata") {
        // Only the shared cooldown changes. This task never alters discovery, revisions,
        // continuation cursors or the fact pipeline's failure counter.
        await this.dbProvider.client.insert(movieSourceState).values({ id: MOVIE_SOURCE_ID, cooldownUntil: retryAt }).onConflictDoUpdate({ target: movieSourceState.id,
          set: { cooldownUntil: sql`greatest(coalesce(${movieSourceState.cooldownUntil}, ${retryAt.toISOString()}::timestamptz), ${retryAt.toISOString()}::timestamptz)`, updatedAt: new Date() } });
      }
    });
  }
  async publish(projection: InterestProjection) {
    assertCompleteProjection(projection);
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      await this.state();
      const [state] = await db.select().from(moviePopularityState).where(eq(moviePopularityState.id, MOVIE_POPULARITY_SOURCE_ID)).for("update");
      if (snapshotDisposition(projection.sourceDate, state.sourceDate) === "unchanged") return { status: "unchanged" as const, observedMovieCount: state.observedMovieCount ?? 0 };
      const qids = projection.observations.map((observation) => observation.wikidataId);
      const known = qids.length ? await db.select({ qid: movies.wikidataId }).from(movies).where(and(inArray(movies.wikidataId, qids), or(isNull(movies.hydratedAt), eq(movies.isFilm, true)))) : [];
      const knownQids = new Set(known.map((movie) => movie.qid));
      const observations = projection.observations.filter((observation) => knownQids.has(observation.wikidataId));
      // Lock publication state before touching source rows; ledger writes follow
      // movie writes, matching persistMovie's movie -> ledger lock order.
      await db.insert(movieSearchState).values({ id: "movies_en", rankingGeneration: 1 }).onConflictDoUpdate({ target: movieSearchState.id,
        set: { rankingGeneration: sql`${movieSearchState.rankingGeneration}+1`, rankingReady: false, updatedAt: new Date() } });
      const affected = await db.select({ id: movies.id }).from(movies).where(or(isNotNull(movies.wikipediaViews), isNotNull(movies.wikipediaSourceDate),
        qids.length ? inArray(movies.wikidataId, qids) : undefined));
      await db.update(movies).set({ wikipediaViews: null, wikipediaSourceDate: null }).where(or(isNotNull(movies.wikipediaViews), isNotNull(movies.wikipediaSourceDate)));
      let observedMovieCount = 0;
      for (let offset = 0; offset < observations.length; offset += 500) {
        const values = sql.join(observations.slice(offset, offset + 500).map((observation) => sql`(${observation.wikidataId}::text, ${observation.views}::integer)`), sql`, `);
        const written = await db.execute(sql`update ${movies} set wikipedia_views=v.views, wikipedia_source_date=${projection.sourceDate}::date
          from (values ${values}) v(qid,views) where ${movies.wikidataId}=v.qid and (${movies.hydratedAt} is null or ${movies.isFilm}=true) returning ${movies.id}`);
        observedMovieCount += written.length;
      }
      for (let offset = 0; offset < affected.length; offset += 500) {
        const values = sql.join(affected.slice(offset, offset + 500).map((movie) => sql`(${movie.id}::uuid)`), sql`, `);
        await db.execute(sql`insert into movie_search_sync (movie_id) values ${values}
          on conflict (movie_id) do update set requested_revision=movie_search_sync.requested_revision+1,dirty_at=now()`);
      }
      await db.update(moviePopularityState).set({ sourceDate: projection.sourceDate, publishedAt: new Date(), lastAttemptAt: new Date(), failureCount: 0, errorCode: null,
        cooldownUntil: sql`case when ${moviePopularityState.cooldownUntil} <= clock_timestamp() then null else ${moviePopularityState.cooldownUntil} end`,
        articleCount: projection.articleCount, mappedArticleCount: projection.mappedArticleCount, missingArticleCount: projection.missingArticleCount,
        duplicateQidCount: projection.duplicateQidCount, observedMovieCount,
      }).where(eq(moviePopularityState.id, MOVIE_POPULARITY_SOURCE_ID));
      return { status: "published" as const, observedMovieCount };
    });
  }
}
