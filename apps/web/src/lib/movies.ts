import { cache } from "react";
import { httpClient } from "./httpClient";
import { formatDate, parseDateKey } from "./formatDate";

export interface MovieCard {
  slug: string;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterImageUrl: string | null;
  posterAttribution: { provider?: "commons" | "wikipedia"; rightsKind?: "reusable" | "non-free";
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
export interface MoviePersonPage extends MovieList {
  person: { wikidataId: string; name: string };
  items: MoviePersonFilm[];
}
export interface MovieRanking {
  mode: "wikipedia_interest" | "alphabetical";
  sourceDate: string | null;
  sourceUrl: string | null;
  isFresh: boolean;
}

/** Only show an observation when the API identifies a fresh, valid source day. */
export function getMovieRankingNotice(ranking: MovieRanking | null | undefined) {
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
  return { date: formatDate(ranking.sourceDate, "en"), sourceUrl };
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

async function movieJson<T>(path: string): Promise<T | null> {
  const response = await httpClient.get(path);
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
  return `/explore/movies/people/${encodeURIComponent(wikidataId)}`;
}

export function moviePageNumber(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export const getMoviePerson = cache((wikidataId: string, page: number) => {
  if (!/^Q[1-9][0-9]{0,20}$/.test(wikidataId)) return Promise.resolve(null);
  const params = new URLSearchParams({ page: String(page), limit: "21" });
  return movieJson<MoviePersonPage>(`/api/movies/people/${encodeURIComponent(wikidataId)}?${params}`);
});
