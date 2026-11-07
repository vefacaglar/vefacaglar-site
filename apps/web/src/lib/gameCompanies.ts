import { cache } from "react";
import type { GameCardItem } from "../app/games/GameGrid";
import { httpClient } from "./httpClient";

export type GameCompanyRole = "developer" | "publisher";
export interface GameCompanyPageData {
  company: {
    id: string;
    name: string;
    slug: string;
    countryCode: string | null;
    role: GameCompanyRole;
  };
  items: GameCardItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function gameCompanyHref(role: GameCompanyRole, slug: string): string {
  const segment = role === "developer" ? "developers" : "publishers";
  return `/games/${segment}/${encodeURIComponent(slug)}`;
}

export function gameCompanyPageNumber(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Request-scoped only: company associations and ranking stay current on each visit. */
export const getGameCompany = cache(async (
  role: GameCompanyRole,
  slug: string,
  page: number,
): Promise<GameCompanyPageData | null> => {
  const query = new URLSearchParams({ page: String(page), limit: "21" });
  const response = await httpClient.get(`/api${gameCompanyHref(role, slug)}?${query}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Game company data fetch failed: ${response.status}`);
  return response.json() as Promise<GameCompanyPageData>;
});
