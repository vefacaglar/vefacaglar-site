import { movieSearchTokens } from "./movie-search-tokens";

export type MovieYearQuery = { words: string; year: number };

const EARLIEST_FILM_YEAR = 1870;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * Splits a typed search such as "rango 2011" into its title words and a release
 * year: the last whitespace-separated 4-digit token (surrounding punctuation like
 * "(2011)" allowed) within 1870..current year + 5. Returns null when there is no
 * such token or nothing searchable remains, so "1917" stays a title search.
 */
export function splitMovieYearQuery(q: string | undefined, now: Date = new Date()): MovieYearQuery | null {
  const parts = q?.trim().split(/\s+/) ?? [];
  const latest = now.getUTCFullYear() + 5;
  for (let index = parts.length - 1; index >= 0; index--) {
    const token = parts[index]!.replace(EDGE_PUNCTUATION, "");
    if (!/^\d{4}$/.test(token)) continue;
    const year = Number(token);
    if (year < EARLIEST_FILM_YEAR || year > latest) continue;
    const words = [...parts.slice(0, index), ...parts.slice(index + 1)].join(" ");
    return movieSearchTokens(words).length ? { words, year } : null;
  }
  return null;
}
