import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { moviePeople, movies } from "@vefacaglar/db";
import { movieSearchTokens } from "./movie-search-tokens";

/**
 * Tokenized prefix match on `to_tsvector('simple', coalesce(column, ''))`, so a
 * GIN index on the same expression can serve it.
 * A query without any letter or digit matches nothing; no query matches everything.
 */
export function prefixTextMatch(column: SQLWrapper, q: string | undefined): SQL | undefined {
  const tokens = movieSearchTokens(q);
  if (q && !tokens.length) return sql`false`;
  return tokens.length ? sql`to_tsvector('simple',coalesce(${column},'')) @@ to_tsquery('simple',${tokens.map((token) => token + ':*').join(' & ')})` : undefined;
}

/** Prefix title match served by the `movies_title_search_idx` GIN index. */
export function movieTitleMatch(q: string | undefined): SQL | undefined {
  return prefixTextMatch(movies.title, q);
}

/** Prefix name match served by the `movie_people_name_search_idx` GIN index. */
export function moviePersonNameMatch(q: string | undefined): SQL | undefined {
  return prefixTextMatch(moviePeople.name, q);
}
