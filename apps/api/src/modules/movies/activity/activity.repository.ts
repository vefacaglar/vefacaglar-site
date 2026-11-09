import { injectable } from "tsyringe";
import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { movies, userMovieWatches, userMovieRatings } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { publicMoviePoster } from "../artwork/poster-source";
import type { IMovieActivityRepository, MovieLibraryRow, MovieWatchRow } from "./activity.repository.interface";
import { latestKnownWatchDate } from "./activity.values";
const publicMovie = () => and(eq(movies.isFilm, true), isNotNull(movies.hydratedAt), isNotNull(movies.title));
@injectable()
export class DrizzleMovieActivityRepository implements IMovieActivityRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async findPublicMovieId(slug: string): Promise<string | null> {
    const [row] = await this.dbProvider.client.select({ id: movies.id }).from(movies).where(and(eq(movies.slug, slug), publicMovie())).limit(1);
    return row?.id ?? null;
  }
  async findWatch(userId: string, movieId: string, id: string): Promise<MovieWatchRow | null> {
    const [row] = await this.dbProvider.client.select().from(userMovieWatches).where(and(eq(userMovieWatches.userId, userId), eq(userMovieWatches.movieId, movieId), eq(userMovieWatches.id, id))).limit(1);
    return row ?? null;
  }
  async getActivity(userId: string, movieId: string, page: number, limit: number) {
    const condition = and(eq(userMovieWatches.userId, userId), eq(userMovieWatches.movieId, movieId));
    const [ratings, watches, totals] = await Promise.all([
      this.dbProvider.client.select({ rating: userMovieRatings.rating }).from(userMovieRatings).where(and(eq(userMovieRatings.userId, userId), eq(userMovieRatings.movieId, movieId))),
      this.dbProvider.client.select().from(userMovieWatches).where(condition).orderBy(desc(userMovieWatches.createdAt), desc(userMovieWatches.id)).limit(limit).offset((page - 1) * limit),
      this.dbProvider.client.select({ total: count() }).from(userMovieWatches).where(condition),
    ]);
    return { rating: ratings[0]?.rating ?? null, watches, total: Number(totals[0]?.total ?? 0) };
  }
  async createWatch(userId: string, movieId: string, id: string, watchedOn: string | null, comment: string | null, isPublic = false): Promise<MovieWatchRow | null> {
    return this.dbProvider.transaction(async () => {
      const [inserted] = await this.dbProvider.client.insert(userMovieWatches).values({ id, userId, movieId, watchedOn, comment, sharedAt: isPublic ? sql`now()` : null }).onConflictDoNothing({ target: userMovieWatches.id }).returning();
      if (inserted) return inserted;
      // A retried request can only replay the exact same owned watch. A collision never becomes an update.
      const [existing] = await this.dbProvider.client.select().from(userMovieWatches).where(and(eq(userMovieWatches.id, id), eq(userMovieWatches.userId, userId), eq(userMovieWatches.movieId, movieId), watchedOn === null ? isNull(userMovieWatches.watchedOn) : eq(userMovieWatches.watchedOn, watchedOn), comment === null ? isNull(userMovieWatches.comment) : eq(userMovieWatches.comment, comment), isPublic ? isNotNull(userMovieWatches.sharedAt) : isNull(userMovieWatches.sharedAt))).limit(1);
      return existing ?? null;
    });
  }
  async updateWatch(userId: string, movieId: string, id: string, watchedOn: string | null | undefined, comment?: string | null, isPublic?: boolean): Promise<MovieWatchRow | null> {
    const [row] = await this.dbProvider.client.update(userMovieWatches).set({ ...(watchedOn === undefined ? {} : { watchedOn }), ...(comment === undefined ? {} : { comment }), ...(isPublic === undefined ? {} : { sharedAt: isPublic ? sql`coalesce(${userMovieWatches.sharedAt}, now())` : null }), updatedAt: new Date() }).where(and(eq(userMovieWatches.id, id), eq(userMovieWatches.userId, userId), eq(userMovieWatches.movieId, movieId))).returning();
    return row ?? null;
  }
  async deleteWatch(userId: string, movieId: string, id: string): Promise<boolean> {
    const rows = await this.dbProvider.client.delete(userMovieWatches).where(and(eq(userMovieWatches.id, id), eq(userMovieWatches.userId, userId), eq(userMovieWatches.movieId, movieId))).returning({ id: userMovieWatches.id });
    return rows.length > 0;
  }
  async setRating(userId: string, movieId: string, rating: number | null): Promise<void> {
    if (rating === null) {
      await this.dbProvider.client.delete(userMovieRatings).where(and(eq(userMovieRatings.userId, userId), eq(userMovieRatings.movieId, movieId)));
    } else {
      await this.dbProvider.client.insert(userMovieRatings).values({ userId, movieId, rating }).onConflictDoUpdate({ target: [userMovieRatings.userId, userMovieRatings.movieId], set: { rating, updatedAt: new Date() } });
    }
  }
  async listLibrary(userId: string): Promise<MovieLibraryRow[]> {
    const [watches, ratings] = await Promise.all([
      this.dbProvider.client.select().from(userMovieWatches).where(eq(userMovieWatches.userId, userId)).orderBy(desc(userMovieWatches.createdAt), desc(userMovieWatches.id)),
      this.dbProvider.client.select().from(userMovieRatings).where(eq(userMovieRatings.userId, userId)),
    ]);
    const ids = [...new Set([...watches.map((watch) => watch.movieId), ...ratings.map((rating) => rating.movieId)])];
    if (!ids.length) return [];
    const rows = await this.dbProvider.client.select().from(movies).where(and(inArray(movies.id, ids), publicMovie()));
    const ratingByMovie = new Map(ratings.map((row) => [row.movieId, row.rating]));
    const watchesByMovie = new Map<string, MovieWatchRow[]>();
    for (const watch of watches) {
      const items = watchesByMovie.get(watch.movieId) ?? [];
      items.push(watch); watchesByMovie.set(watch.movieId, items);
    }
    return rows.map((movie) => ({ movie: { slug: movie.slug, title: movie.title!, releaseDate: movie.releaseDate, releaseYear: movie.releaseYear,
      runtimeMinutes: movie.runtimeMinutes, ...publicMoviePoster(movie) }, rating: ratingByMovie.get(movie.id) ?? null, watches: watchesByMovie.get(movie.id) ?? [] }))
      .sort((a, b) => (latestKnownWatchDate(b.watches) ?? "").localeCompare(latestKnownWatchDate(a.watches) ?? "") || a.movie.title.localeCompare(b.movie.title) || a.movie.slug.localeCompare(b.movie.slug));
  }
}
