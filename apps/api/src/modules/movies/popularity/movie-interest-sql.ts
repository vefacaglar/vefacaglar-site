import { movies, moviePopularityState } from "@vefacaglar/db";
import { sql, type SQL } from "drizzle-orm";
import { MOVIE_AUDIENCE_SOURCE_ID, type AudienceSourceSummary } from "./audience.types";

export function hasPublicMovieInterestSql(sourceDate: SQL): SQL<boolean> {
  return sql<boolean>`exists (select 1 from ${movies} where ${movies.isFilm}=true and ${movies.hydratedAt} is not null
    and ${movies.title} is not null and ${movies.popularitySourceDate}=${sourceDate} and ${movies.popularityScore} is not null
    and (${movies.popularitySourceMask} & 3) > 0)`;
}
export function audienceSourceDetailsSql(sourceDate: SQL): SQL<AudienceSourceSummary[] | null> {
  return sql`(select source_details from ${moviePopularityState} where id=${MOVIE_AUDIENCE_SOURCE_ID} and source_date is not distinct from ${sourceDate})`;
}
export function audienceSourcesFreshSql(details: SQL): SQL<boolean> {
  return sql<boolean>`(exists (select 1 from jsonb_array_elements(${details}) source
      where source->>'provider' in ('tmdb','netflix') and (source->>'matchedCount')::integer > 0)
    and not exists (select 1 from jsonb_array_elements(${details}) source
      where (source->>'matchedCount')::integer > 0 and ((source->>'expiresAt')::timestamptz <= statement_timestamp()
        or (source->>'sourceDate')::date > (statement_timestamp() at time zone 'UTC')::date)))`;
}
