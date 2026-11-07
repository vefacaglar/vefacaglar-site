import { cache } from "react";
import { cookies } from "next/headers";
import { httpClient } from "./httpClient";
import type { MovieCard } from "./movies";
import type { ProfileUser } from "./profileLibrary";
export type MovieWatch = { id: string; watchedOn: string; createdAt: string; updatedAt: string };
export type MovieActivity = { rating: number | null; watches: MovieWatch[]; total: number; page: number; limit: number; totalPages: number };
export type ProfileMovie = MovieCard & { rating: number | null; watchCount: number; lastWatchedOn: string | null; watches: { id?: string; watchedOn: string }[] };
export type MovieLibrary = { user: ProfileUser; isOwner: boolean;
  summary: { filmCount: number; watchedFilmCount: number; watchCount: number; ratedFilmCount: number; averageRating: number | null }; movies: ProfileMovie[] };
export const getMyMovieActivity = cache(async (slug: string, page = 1): Promise<MovieActivity | null> => {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return null;
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  const response = await httpClient.get(`/api/movies/${encodeURIComponent(slug)}/activity?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Movie activity fetch failed: ${response.status}`);
  return response.json();
});
export type MovieLibraryResult = { kind: "ok"; data: MovieLibrary } | { kind: "private"; signedIn: boolean } | { kind: "not_found" };
export const getMovieLibrary = cache(async (username: string): Promise<MovieLibraryResult> => {
  const token = (await cookies()).get("session_token")?.value;
  const response = await httpClient.get(`/api/movies/users/${encodeURIComponent(username)}/library`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (response.ok) return { kind: "ok", data: await response.json() };
  if (response.status === 401) return { kind: "private", signedIn: false };
  if (response.status === 403) return { kind: "private", signedIn: true };
  if (response.status === 404) return { kind: "not_found" };
  throw new Error(`Movie library fetch failed: ${response.status}`);
});
