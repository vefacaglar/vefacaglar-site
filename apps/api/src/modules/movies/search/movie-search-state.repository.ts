import { injectable } from "tsyringe";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { movieSearchState, movieSearchSync, recurringJobs } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";

import { MOVIE_SEARCH_ID, type IMovieSearchStateRepository } from "./movie-search.types";

/** The recurring due time is a durable, coalesced request, consumed by the worker. */
export async function requestMovieSearchSync(db: DbProvider["client"]) {
  // Always serialize with dispatch, even when already due: skipping this lock
  // can lose a source change while a dispatcher advances the due marker.
  const [registration] = await db.select({ id: recurringJobs.id }).from(recurringJobs)
    .where(and(eq(recurringJobs.id, "search.movies.sync"), eq(recurringJobs.type, "search.movies.sync"),
      eq(recurringJobs.enabled, true), isNotNull(recurringJobs.cron)))
    .for("no key update");
  if (!registration) return;
  await db.execute(sql`with requested as (
    update ${recurringJobs} set next_run_at=clock_timestamp(),updated_at=clock_timestamp()
    where ${recurringJobs.id}=${registration.id}
      and (${recurringJobs.nextRunAt} is null or ${recurringJobs.nextRunAt}>clock_timestamp())
    returning ${recurringJobs.id}
  ) select pg_notify('jobs',id) from requested`);
}

/** Called only inside the source writer's DbProvider transaction. */
export async function dirtyMovieSearch(db: DbProvider["client"], movieId: string) {
  await db.insert(movieSearchSync).values({ movieId }).onConflictDoUpdate({ target: movieSearchSync.movieId,
    set: { requestedRevision: sql`${movieSearchSync.requestedRevision} + 1`, dirtyAt: new Date() } });
  await requestMovieSearchSync(db);
}

@injectable()
export class DrizzleMovieSearchStateRepository implements IMovieSearchStateRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() {
    const [state] = await this.dbProvider.client.select().from(movieSearchState).where(eq(movieSearchState.id, MOVIE_SEARCH_ID));
    return state ?? null;
  }
}
