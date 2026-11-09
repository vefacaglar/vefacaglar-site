"use server";

import { authedRequest, authedMutation } from "../../../lib/apiAction";
import type { MovieListResult, MovieStats } from "./types";

export async function listDashboardMoviesAction(params: { page: number; limit: number; q?: string; blocked?: boolean }) {
  const search = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.blocked) search.set("blocked", "true");
  return authedRequest<MovieListResult>("GET", `/api/movies/dashboard/movies?${search}`, { fallbackError: "Failed to fetch movies." });
}

export async function getMovieStatsAction() {
  return authedRequest<MovieStats>("GET", "/api/movies/dashboard/stats", { fallbackError: "Failed to fetch movie stats." });
}

/** A successful PUT also invalidates every cached public page, so the poster disappears or returns site-wide. */
export async function setMoviePosterBlockAction(id: string, blocked: boolean) {
  return authedMutation("PUT", `/api/movies/dashboard/movies/${encodeURIComponent(id)}/poster-block`, {
    body: { blocked },
    revalidate: ["/dashboard/movies"],
    fallbackError: "Could not update the poster block.",
  });
}
