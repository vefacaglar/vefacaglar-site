import { cache } from "react";
import { httpClient } from "./httpClient";

export interface MovieCard {
  slug: string;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterImageUrl: string | null;
}
export interface MovieList {
  items: MovieCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface MovieCredit {
  statementId: string;
  role: "cast" | "director" | "producer";
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
