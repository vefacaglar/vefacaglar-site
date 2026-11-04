import type { LibraryGame } from "../../lib/profileLibrary";
import { GAME_LOG_STATUSES } from "../games/gameLogStatus";

// Status tabs and sort order for a profile's games shelf, read from the URL
// (`?status=completed&sort=playtime`) so the page stays fully server-rendered.

export type ShelfStatus = LibraryGame["status"];
export type ShelfTab = "all" | ShelfStatus;
export type ShelfSort = "activity" | "playtime" | "completed";

export const SHELF_TABS: ShelfTab[] = ["all", ...GAME_LOG_STATUSES];

/** Completion date only means something where finished games are on the shelf. */
export function sortsFor(tab: ShelfTab): ShelfSort[] {
  return tab === "all" || tab === "completed" ? ["activity", "playtime", "completed"] : ["activity", "playtime"];
}

export function defaultSort(tab: ShelfTab): ShelfSort {
  return tab === "completed" ? "completed" : "activity";
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTab(raw: string | string[] | undefined): ShelfTab {
  const value = first(raw);
  return SHELF_TABS.find((tab) => tab === value) ?? "all";
}

/** Falls back to the tab's default when the sort is missing or doesn't apply to this tab. */
export function parseSort(raw: string | string[] | undefined, tab: ShelfTab): ShelfSort {
  const value = first(raw);
  return sortsFor(tab).find((sort) => sort === value) ?? defaultSort(tab);
}

/** Query string for a tab + sort, leaving out whatever is already the default. */
export function shelfQuery(tab: ShelfTab, sort: ShelfSort): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (sort !== defaultSort(tab)) params.set("sort", sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Latest activity as a timestamp; falls back to the last log for responses without it. */
export function activityTime(game: LibraryGame): number {
  return Date.parse(game.lastActivityAt) || Date.parse(game.lastLoggedAt) || 0;
}

const byTitle = (a: LibraryGame, b: LibraryGame) => a.title.localeCompare(b.title);

/** Descending, with missing values last. */
function desc(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return b - a;
}

export function sortShelf(games: LibraryGame[], sort: ShelfSort): LibraryGame[] {
  const key = (game: LibraryGame): number | null => {
    if (sort === "playtime") return game.playtimeHours;
    // YYYY-MM-DD compares correctly as a number once the dashes go.
    if (sort === "completed") return Number(game.completedAt?.slice(0, 10).replace(/-/g, "")) || null;
    return activityTime(game);
  };
  return [...games].sort((a, b) => desc(key(a), key(b)) || byTitle(a, b));
}
