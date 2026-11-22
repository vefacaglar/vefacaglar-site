import { cache } from "react";
import { httpClient } from "./httpClient";
import { formatDate } from "./formatDate";
export interface TvRanking {
  mode: "current_popularity" | "alphabetical";
  isFresh: boolean;
  sources: { provider: string; sourceDate: string; windowStart: string; expiresAt: string; sourceUrl: string }[];
}
export interface TvSeriesCard {
  id: number; title: string; summary: string | null; premiered: string | null; ended: string | null;
  status: string | null; genres: string[]; rating: number | null; ratingSource: "tvmaze"; sourceUrl: string;
  seasonCount: number | null; episodeCount: number | null; specialCount: number | null;
}
export interface TvSeriesList {
  items: TvSeriesCard[]; total: number; page: number; limit: number; totalPages: number; ranking: TvRanking;
}
export interface TvSeason {
  id: number; number: number | null; name: string | null; summary: string | null; episodeOrder: number | null; network: string | null; premiered: string | null; ended: string | null;
  episodeCount: number | null; specialCount: number | null;
}
export interface TvEpisode {
  id: number; isSpecial: boolean; number: number | null; name: string | null; summary: string | null; type: string | null;
  airdate: string | null; airstamp: string | null; runtimeMinutes: number | null; rating: number | null; sourceUrl: string;
}
export interface TvSeriesDetail extends TvSeriesCard {
  language: string | null; type: string | null; runtimeMinutes: number | null; officialSite: string | null;
  network: string | null; firstAired: string | null; lastAired: string | null; updatedAt: string; hierarchyUpdatedAt: string | null; hierarchyStatus: "pending" | "complete";
  seasons: TvSeason[]; orphanSpecials: TvEpisode[];
}
export interface TvSeasonDetail {
  series: { id: number; title: string }; season: TvSeason; episodes: TvEpisode[];
  hierarchyStatus: "pending" | "complete"; sourceUrl: string;
}
async function tvJson<T>(path: string): Promise<T | null> {
  const response = await httpClient.get(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`TV series data fetch failed: ${response.status}`);
  return response.json() as Promise<T>;
}
export function tvSeriesId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}
export function tvPage(value?: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
}
export const getTvSeriesList = cache((page: number, query?: string, limit = 21) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (query) params.set("q", query);
  return tvJson<TvSeriesList>(`/api/tv-series?${params}`);
});
export const getTvSeries = cache((id: number) => tvJson<TvSeriesDetail>(`/api/tv-series/${id}`));
export const getTvSeason = cache((id: number, seasonId: number) => tvJson<TvSeasonDetail>(`/api/tv-series/${id}/seasons/${seasonId}`));
export function tvSeriesYears(series: Pick<TvSeriesCard, "premiered" | "ended" | "status">): string | null {
  const first = series.premiered?.slice(0, 4);
  if (!first || !/^\d{4}$/.test(first)) return null;
  const last = series.ended?.slice(0, 4);
  if (last && /^\d{4}$/.test(last)) return last === first ? first : `${first}–${last}`;
  return series.status === "Running" ? `${first}–present` : first;
}
export function tvSeasonName(season: Pick<TvSeason, "number" | "name">): string {
  const label = season.number === null ? "Specials" : `Season ${season.number}`;
  return season.name && season.name.toLowerCase() !== label.toLowerCase() ? `${label} · ${season.name}` : label;
}
export function tvCount(value: number, singular: string): string {
  return `${value.toLocaleString("en-GB")} ${singular}${value === 1 ? "" : "s"}`;
}
export function tvDate(value: string | null): string | null {
  return value ? formatDate(value, "en") || null : null;
}
export function tvRating(value: number | null): string | null {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 10 ? `${value.toFixed(1)}/10` : null;
}

export function tvEpisodeDate(episode: Pick<TvEpisode, "airdate" | "airstamp">, now = new Date()): string | null {
  const date = tvDate(episode.airdate);
  if (!date) return null;
  const stamp = episode.airstamp ? Date.parse(episode.airstamp) : NaN;
  const future = Number.isFinite(stamp) ? stamp > now.getTime() : episode.airdate! > now.toISOString().slice(0, 10);
  return future ? `Scheduled ${date}` : date;
}
