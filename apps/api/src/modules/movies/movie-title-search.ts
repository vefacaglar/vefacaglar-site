import { sql, type SQL } from "drizzle-orm";
import { movies } from "@vefacaglar/db";

/**
 * Prefix title match served by the `movies_title_search_idx` GIN index.
 * A query without any letter or digit matches nothing; no query matches everything.
 */
export function movieTitleMatch(q: string | undefined): SQL | undefined {
  const tokens = q?.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
  if (q && !tokens.length) return sql`false`;
  return tokens.length ? sql`to_tsvector('simple',coalesce(${movies.title},'')) @@ to_tsquery('simple',${tokens.map((token) => token + ':*').join(' & ')})` : undefined;
}
