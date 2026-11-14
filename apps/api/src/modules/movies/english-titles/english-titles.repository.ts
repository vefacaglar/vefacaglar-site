import { injectable } from "tsyringe";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { movieEnglishTitleState, movies, movieSourceState } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { posterInputsPatch } from "../artwork/poster-source";
import { MOVIE_SOURCE_ID } from "../import/movie-source.types";
import { dirtyMovieSearch } from "../search/movie-search-state.repository";
import { MOVIE_ENGLISH_TITLE_STATE_ID, type EnglishTitleState, type IMovieEnglishTitleRepository } from "./english-titles.types";

@injectable()
export class DrizzleMovieEnglishTitleRepository implements IMovieEnglishTitleRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async state(): Promise<EnglishTitleState> {
    const db = this.dbProvider.client;
    await db.insert(movieEnglishTitleState).values({ id: MOVIE_ENGLISH_TITLE_STATE_ID }).onConflictDoNothing();
    const [row] = await db.select().from(movieEnglishTitleState).where(eq(movieEnglishTitleState.id, MOVIE_ENGLISH_TITLE_STATE_ID));
    return { cursor: row.cursor, passStartedAt: row.passStartedAt, lastPassCompletedAt: row.lastPassCompletedAt,
      passScanned: row.passScanned, passChanged: row.passChanged, failureCount: row.failureCount };
  }

  async saveState(patch: Partial<EnglishTitleState> & { errorCode?: string | null }): Promise<void> {
    const errorCode = patch.errorCode === undefined ? {} : { errorCode: patch.errorCode?.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) ?? null };
    await this.dbProvider.client.update(movieEnglishTitleState).set({ ...patch, ...errorCode, updatedAt: new Date() })
      .where(eq(movieEnglishTitleState.id, MOVIE_ENGLISH_TITLE_STATE_ID));
  }

  async wikidataCooldown(): Promise<Date | null> {
    const [state] = await this.dbProvider.client.select({ cooldown: movieSourceState.cooldownUntil }).from(movieSourceState).where(eq(movieSourceState.id, MOVIE_SOURCE_ID));
    return state?.cooldown ?? null;
  }

  async recordWikidataCooldown(until: Date): Promise<void> {
    // Only the shared cooldown changes; the fact pipeline's cursors and counters stay untouched.
    await this.dbProvider.client.insert(movieSourceState).values({ id: MOVIE_SOURCE_ID, cooldownUntil: until }).onConflictDoUpdate({ target: movieSourceState.id,
      set: { cooldownUntil: sql`greatest(coalesce(${movieSourceState.cooldownUntil}, ${until.toISOString()}::timestamptz), ${until.toISOString()}::timestamptz)`, updatedAt: new Date() } });
  }

  candidates(afterId: string | null, limit: number) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, slug: movies.slug, title: movies.title }).from(movies)
      .where(and(eq(movies.isFilm, true), isNotNull(movies.hydratedAt), afterId ? gt(movies.id, afterId) : undefined))
      .orderBy(asc(movies.id)).limit(limit);
  }

  async replaceTitle(movieId: string, expectedTitle: string | null, title: string, now: Date): Promise<boolean> {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [existing] = await db.select().from(movies).where(eq(movies.id, movieId)).for("update");
      // A concurrent snapshot already rewrote the title; it wins.
      if (!existing || existing.title !== expectedTitle || existing.title === title) return false;
      // Same poster invalidation as persistMovie on a title change; source inputs are unchanged.
      const { posterInputsCheckedAt: _checked, ...poster } = posterInputsPatch(existing,
        { posterFileName: existing.posterFileName, enwikiArticle: existing.enwikiArticle, commonsCategory: existing.commonsCategory, title }, now);
      await db.update(movies).set({ ...poster, title, updatedAt: now }).where(eq(movies.id, existing.id));
      await dirtyMovieSearch(db, existing.id);
      return true;
    });
  }
}
