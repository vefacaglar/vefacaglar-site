import { injectable } from "tsyringe";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { movies, userMovieRatings, userMovieWatches, users } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { IMovieCommunityRepository } from "./community.repository.interface";

@injectable()
export class DrizzleMovieCommunityRepository implements IMovieCommunityRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findPublicMovieId(slug: string): Promise<string | null> {
    const [row] = await this.dbProvider.client.select({ id: movies.id }).from(movies)
      .where(and(eq(movies.slug, slug), eq(movies.isFilm, true), isNotNull(movies.hydratedAt), isNotNull(movies.title))).limit(1);
    return row?.id ?? null;
  }

  async getCommunity(movieId: string, page: number, limit: number) {
    const publicAuthor = and(eq(users.isActive, true), eq(users.isProfilePublic, true));
    const shared = and(eq(userMovieWatches.movieId, movieId), publicAuthor, isNotNull(userMovieWatches.sharedAt));
    const [ratings, totals, rows] = await Promise.all([
      this.dbProvider.client.select({ average: sql<number | null>`round(avg(${userMovieRatings.rating})::numeric, 1)::double precision`, count: count() })
        .from(userMovieRatings).innerJoin(users, eq(userMovieRatings.userId, users.id))
        .where(and(eq(userMovieRatings.movieId, movieId), publicAuthor)),
      this.dbProvider.client.select({ total: count() }).from(userMovieWatches).innerJoin(users, eq(userMovieWatches.userId, users.id)).where(shared),
      this.dbProvider.client.select({
        id: userMovieWatches.id,
        author: { username: users.username, displayName: users.displayName },
        sharedAt: userMovieWatches.sharedAt,
        text: userMovieWatches.comment,
        rating: userMovieRatings.rating,
        watchedOn: userMovieWatches.watchedOn,
      }).from(userMovieWatches).innerJoin(users, eq(userMovieWatches.userId, users.id))
        .leftJoin(userMovieRatings, and(eq(userMovieRatings.userId, userMovieWatches.userId), eq(userMovieRatings.movieId, userMovieWatches.movieId)))
        .where(shared).orderBy(desc(userMovieWatches.sharedAt), desc(userMovieWatches.id)).limit(limit).offset((page - 1) * limit),
    ]);
    return {
      rating: { average: ratings[0]?.average == null ? null : Number(ratings[0].average), count: Number(ratings[0]?.count ?? 0) },
      entries: rows.map((row) => ({ ...row, sharedAt: row.sharedAt! })),
      total: Number(totals[0]?.total ?? 0),
    };
  }
}
