import { movies } from "@vefacaglar/db";
import { sql, type SQL } from "drizzle-orm";

export function hasPublicMovieInterestSql(sourceDate: SQL): SQL<boolean> {
  return sql<boolean>`exists (select 1 from ${movies} where ${movies.isFilm}=true and ${movies.hydratedAt} is not null
    and ${movies.title} is not null and ${movies.wikipediaSourceDate}=${sourceDate} and ${movies.wikipediaViews} is not null)`;
}
