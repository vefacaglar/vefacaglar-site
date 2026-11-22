import { injectable } from "tsyringe";
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { movies, moviePopularityState, movieSourceState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { MOVIE_SOURCE_ID } from "../import/movie-source.types";
import { assertCompleteProjection, snapshotDisposition, utcDay } from "./wikipedia-interest";
import { MOVIE_POPULARITY_SOURCE_ID, type IMoviePopularityRepository, type InterestProjection, type MoviePopularityState } from "./popularity.types";
@injectable()
export class DrizzleMoviePopularityRepository implements IMoviePopularityRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state(): Promise<MoviePopularityState> {
    await this.dbProvider.client.insert(moviePopularityState).values({ id: MOVIE_POPULARITY_SOURCE_ID,
      // A new measurement version must still honor an outstanding provider wait.
      cooldownUntil: sql`(select cooldown_until from ${moviePopularityState} where id='enwiki-top-articles-v1')`,
    }).onConflictDoNothing();
    const [state] = await this.dbProvider.client.select().from(moviePopularityState).where(eq(moviePopularityState.id, MOVIE_POPULARITY_SOURCE_ID));
    return state;
  }
  async interestCandidates(now: Date) {
    const day = utcDay(now);
    return this.dbProvider.client.select({ wikidataId: movies.wikidataId, article: movies.enwikiArticle }).from(movies)
      .where(and(eq(movies.isFilm, true), isNotNull(movies.hydratedAt), isNotNull(movies.title), isNotNull(movies.enwikiArticle),
        sql`coalesce(${movies.releaseDate}::date, case when ${movies.releaseYear} between 1 and 9999 then make_date(${movies.releaseYear},7,1) end)
          between (${day}::date-365) and (${day}::date-1)`))
      .orderBy(sql`${movies.wikipediaLanguageCount} desc nulls last`, desc(movies.releaseYear), movies.id).limit(16)
      .then((rows) => rows.filter((row): row is { wikidataId: string; article: string } => !!row.article?.trim()));
  }
  async knownMovieQids(qids: string[]) {
    if (!qids.length) return [];
    return (await this.dbProvider.client.select({ qid: movies.wikidataId }).from(movies)
      .where(and(inArray(movies.wikidataId, qids), or(isNull(movies.hydratedAt), eq(movies.isFilm, true)))))
      .map((row) => row.qid);
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
      const measured = projection.rollingObservations;
      const qids = measured.map((observation) => observation.wikidataId);
      const known = qids.length ? await db.select({ qid: movies.wikidataId }).from(movies).where(and(inArray(movies.wikidataId, qids), or(isNull(movies.hydratedAt), eq(movies.isFilm, true)))) : [];
      const knownQids = new Set(known.map((movie) => movie.qid));
      const observations = measured.filter((observation) => knownQids.has(observation.wikidataId));
      // Raw Wikipedia evidence is independent of the combined ranking publication.
      await db.update(movies).set({ wikipediaViews: null, wikipediaSourceDate: null }).where(or(isNotNull(movies.wikipediaViews), isNotNull(movies.wikipediaSourceDate)));
      let observedMovieCount = 0;
      for (let offset = 0; offset < observations.length; offset += 500) {
        const values = sql.join(observations.slice(offset, offset + 500).map((observation) => sql`(${observation.wikidataId}::text, ${observation.views}::integer)`), sql`, `);
        const written = await db.execute(sql`update ${movies} set wikipedia_views=v.views, wikipedia_source_date=${projection.sourceDate}::date
          from (values ${values}) v(qid,views) where ${movies.wikidataId}=v.qid and (${movies.hydratedAt} is null or ${movies.isFilm}=true) returning ${movies.id}`);
        observedMovieCount += written.length;
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
