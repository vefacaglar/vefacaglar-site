import { injectable } from "tsyringe";
import { eq, sql, getTableColumns } from "drizzle-orm";
import { moviePeopleSearchState, movieSearchState, movieSearchSync } from "@vefacaglar/db";
import { audienceSourceDetailsSql, hasPublicMovieInterestSql } from "../popularity/movie-interest-sql";
import { DbProvider } from "../../../db.provider";

import { MOVIE_PEOPLE_SEARCH_ID, MOVIE_SEARCH_ID, type IMoviePeopleSearchStateRepository, type IMovieSearchStateRepository } from "./movie-search.types";

/** Called only inside the source writer's DbProvider transaction. */
export async function dirtyMovieSearch(db: DbProvider["client"], movieId: string) {
  await db.insert(movieSearchSync).values({ movieId }).onConflictDoUpdate({ target: movieSearchSync.movieId,
    set: { requestedRevision: sql`${movieSearchSync.requestedRevision} + 1`, dirtyAt: new Date() } });
}

@injectable()
export class DrizzleMovieSearchStateRepository implements IMovieSearchStateRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() {
    const [state] = await this.dbProvider.client.select({ ...getTableColumns(movieSearchState), hasPublicInterest: hasPublicMovieInterestSql(sql`${movieSearchState.publishedSourceDate}`),
      sourceDetails: audienceSourceDetailsSql(sql`${movieSearchState.publishedSourceDate}`) }).from(movieSearchState).where(eq(movieSearchState.id, MOVIE_SEARCH_ID));
    return state ?? null;
  }
}

@injectable()
export class DrizzleMoviePeopleSearchStateRepository implements IMoviePeopleSearchStateRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() {
    const [state] = await this.dbProvider.client.select().from(moviePeopleSearchState).where(eq(moviePeopleSearchState.id, MOVIE_PEOPLE_SEARCH_ID));
    return state ?? null;
  }
}
