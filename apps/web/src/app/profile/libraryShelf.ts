import type { LibraryGame, LibraryPlatformCount } from "../../lib/profileLibrary";
import { GAME_LOG_STATUSES } from "../games/gameLogStatus";

// Status tabs and sort order for a profile's games shelf, read from the URL
// (`?status=completed&sort=playtime`) so the page stays fully server-rendered.

export type ShelfStatus = LibraryGame["status"];
export type ShelfTab = "all" | ShelfStatus;
export type ShelfSort = "activity" | "playtime" | "completed";
/** Cover wall (default) or a ledger-style list, from `?view=list`. */
export type ShelfView = "grid" | "list";

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

export function parseView(raw: string | string[] | undefined): ShelfView {
  return first(raw) === "list" ? "list" : "grid";
}

export const SHELF_VIEW_STORAGE_KEY = "library_shelf_view";
export const SHELF_SORT_STORAGE_KEY = "library_shelf_sort";
export const SHELF_TAB_STORAGE_KEY = "library_shelf_tab";

export type ShelfStorage = Pick<Storage, "getItem" | "setItem">;

/** Reads the saved shelf tab from storage (`localStorage`), falling back to `"all"`. */
export function readStoredTab(storage?: ShelfStorage | null): ShelfTab {
  try {
    return parseTab(storage?.getItem(SHELF_TAB_STORAGE_KEY) ?? undefined);
  } catch {
    return "all";
  }
}

/** Saves the chosen shelf tab to storage (`localStorage`). */
export function writeStoredTab(tab: ShelfTab, storage?: ShelfStorage | null): void {
  try {
    storage?.setItem(SHELF_TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

/** Reads the saved shelf view from storage (`localStorage`), falling back to `"grid"`. */
export function readStoredView(storage?: ShelfStorage | null): ShelfView {
  try {
    return storage?.getItem(SHELF_VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Saves the chosen shelf view (`"grid"` or `"list"`) to storage (`localStorage`). */
export function writeStoredView(view: ShelfView, storage?: ShelfStorage | null): void {
  try {
    storage?.setItem(SHELF_VIEW_STORAGE_KEY, view);
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

/** Reads the saved shelf sort from storage (`localStorage`), validated against `tab`. */
export function readStoredSort(tab: ShelfTab, storage?: ShelfStorage | null): ShelfSort {
  try {
    return parseSort(storage?.getItem(SHELF_SORT_STORAGE_KEY) ?? undefined, tab);
  } catch {
    return defaultSort(tab);
  }
}

/** Saves the chosen shelf sort to storage (`localStorage`). */
export function writeStoredSort(sort: ShelfSort, storage?: ShelfStorage | null): void {
  try {
    storage?.setItem(SHELF_SORT_STORAGE_KEY, sort);
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

/** Query string for a tab + sort + view, leaving out whatever is already the default. */
export function shelfQuery(tab: ShelfTab, sort: ShelfSort, view: ShelfView = "grid"): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (sort !== defaultSort(tab)) params.set("sort", sort);
  if (view !== "grid") params.set("view", view);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Games per platform for a set of games, most first, then by name. Games without a
 * platform are left out, matching the API's library summary.
 */
export function platformCounts(games: LibraryGame[]): LibraryPlatformCount[] {
  const counts = new Map<string, number>();
  for (const game of games) {
    if (game.platformName) counts.set(game.platformName, (counts.get(game.platformName) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
