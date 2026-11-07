import { injectable } from "tsyringe";
import { eq, sql } from "drizzle-orm";
import { movieSearchState, movieSearchSync } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";

import { MOVIE_SEARCH_ID, type IMovieSearchStateRepository } from "./movie-search.types";

/** Called only inside the source writer's DbProvider transaction. */
export async function dirtyMovieSearch(db: DbProvider["client"], movieId: string) {
  await db.insert(movieSearchSync).values({ movieId }).onConflictDoUpdate({ target: movieSearchSync.movieId,
    set: { requestedRevision: sql`${movieSearchSync.requestedRevision} + 1`, dirtyAt: new Date() } });
}

@injectable()
export class DrizzleMovieSearchStateRepository implements IMovieSearchStateRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() {
    const [state] = await this.dbProvider.client.select().from(movieSearchState).where(eq(movieSearchState.id, MOVIE_SEARCH_ID));
    return state ?? null;
  }
}
