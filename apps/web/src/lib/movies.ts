import { cache } from "react";
import { httpClient } from "./httpClient";
import { formatDate, parseDateKey } from "./formatDate";
import { moviePersonPath } from "./movieSearch";

export interface MovieCard {
  slug: string;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterImageUrl: string | null;
  posterAttribution: { provider?: "commons" | "wikipedia"; rightsKind?: "reusable";
    sourceUrl: string; artist: string | null; license: string; licenseUrl: string | null } | null;
}
export interface MovieList {
  items: MovieCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ranking: MovieRanking;
}
export type MoviePersonRole = "cast" | "director" | "producer";
export interface MoviePersonFilm extends MovieCard { roles: MoviePersonRole[] }
export interface MoviePersonPage {
  person: { wikidataId: string; name: string };
  items: MoviePersonFilm[];
  total: number;
}
export interface MovieRanking {
  mode: "wikipedia_interest" | "alphabetical";
  sourceDate: string | null;
  sourceUrl: string | null;
  isFresh: boolean;
}

/** Only show an observation when the API identifies a fresh, valid source day. */
export function getMovieRankingNotice(ranking: MovieRanking | null | undefined, lang = "en") {
  if (!ranking || ranking.mode !== "wikipedia_interest" || !ranking.isFresh ||
      !ranking.sourceDate || !/^\d{4}-\d{2}-\d{2}$/.test(ranking.sourceDate) ||
      !parseDateKey(ranking.sourceDate)) return null;

  const fallback = "https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html";
  let sourceUrl = fallback;
  if (ranking.sourceUrl) {
    try {
      const source = new URL(ranking.sourceUrl);
      if (source.protocol === "https:" && !source.username && !source.password && !source.port &&
          ((source.hostname === "wikimedia.org" && source.pathname.startsWith("/api/rest_v1/metrics/pageviews/")) ||
           (source.hostname === "doc.wikimedia.org" && source.pathname.startsWith("/generated-data-platform/aqs/")))) {
        sourceUrl = source.href;
      }
    } catch {
      // The link falls back to the source documentation if the URL is invalid.
    }
  }
  return { date: formatDate(ranking.sourceDate, lang), sourceUrl };
}
export interface MovieCredit {
  statementId: string;
  role: MoviePersonRole;
  wikidataId: string;
  name: string | null;
  characterNames: string[];
  rank: "preferred" | "normal" | "deprecated";
}
export interface MovieDetail extends MovieCard {
  wikidataId: string;
  imdbId: string | null;
  description: string | null;
  originalTitle: string | null;
  genres: { name: string; slug: string }[];
  companies: { wikidataId: string; name: string | null }[];
  credits: MovieCredit[];
  sourceUpdatedAt: string | null;
}

async function movieJson<T>(path: string, init?: { signal?: AbortSignal }): Promise<T | null> {
  const response = await (init ? httpClient.get(path, init) : httpClient.get(path));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Movie data fetch failed: ${response.status}`);
  return response.json() as Promise<T>;
}

/** Request-scoped deduplication only: imports are visible on the next visit. */
export const getPublicMovies = cache((page: number, query?: string) => {
  const params = new URLSearchParams({ page: String(page), limit: "21" });
  if (query) params.set("q", query);
  return movieJson<MovieList>(`/api/movies?${params}`);
});
export const getMovie = cache((slug: string) =>
  movieJson<MovieDetail>(`/api/movies/${encodeURIComponent(slug)}`)
);

export function moviePersonHref(wikidataId: string) {
  return moviePersonPath(wikidataId);
}

export function moviePageNumber(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export const getMoviePerson = cache((wikidataId: string) => {
  if (!/^Q[1-9][0-9]{0,20}$/.test(wikidataId)) return Promise.resolve(null);
  return movieJson<MoviePersonPage>(`/api/movies/people/${encodeURIComponent(wikidataId)}`);
});

export interface MovieSuggestion {
  slug: string;
  title: string;
  releaseYear: number | null;
  director: string | null;
}
export interface MoviePersonSummary {
  wikidataId: string;
  name: string;
  roles: MoviePersonRole[];
  knownFor: { slug: string; title: string; releaseYear: number | null } | null;
}
export type MovieSuggestionGroup = "movies" | "people";
export interface MovieSuggestions {
  movies: MovieSuggestion[];
  people: MoviePersonSummary[];
  /** Best-matching group first; older API responses omit it (see `parseMovieSuggestions`). */
  order?: MovieSuggestionGroup[];
}

export function getMovieSuggestions(query: string, init?: { signal?: AbortSignal }) {
  const params = new URLSearchParams({ q: query });
  return movieJson<MovieSuggestions>(`/api/movies/suggest?${params}`, init);
}

/** People section of the search results page. */
export const searchMoviePeople = cache((query: string) => {
  const params = new URLSearchParams({ q: query, limit: "12" });
  return movieJson<{ items: MoviePersonSummary[] }>(`/api/movies/people?${params}`);
});
