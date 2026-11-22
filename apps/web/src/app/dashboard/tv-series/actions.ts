"use server";
import { authedRequest } from "../../../lib/apiAction";
import type { TvDashboardStats, TvDashboardList } from "./types";

export async function getTvDashboardStats() {
  return authedRequest<TvDashboardStats>("GET", "/api/tv-series/dashboard/stats", { fallbackError: "Failed to fetch TV series stats." });
}
export async function listDashboardTv(params: { page: number; limit: number; q: string; hydration: string }) {
  const search = new URLSearchParams({ page: String(params.page), limit: String(params.limit), hydration: params.hydration });
  if (params.q.trim()) search.set("q", params.q.trim());
  return authedRequest<TvDashboardList>("GET", `/api/tv-series/dashboard/series?${search}`, { fallbackError: "Failed to fetch TV series." });
}
