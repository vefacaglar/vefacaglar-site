import { istanbulToday, isAllowedLogDate } from "./logDates";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type MovieLogPreferences = { watchedOn: string | null; isPublic: boolean };
export type GameLogPreferences = { startedAt: string | null; completedAt: string | null; isPublic: boolean };

function storageKey(userId: string, media: "movie" | "game"): string {
  return `library_log_preferences_v1_${media}_${userId}`;
}

function browserStorage(): StorageLike | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

function read(userId: string | null, media: "movie" | "game", storage: StorageLike | undefined): Record<string, unknown> | null {
  if (!userId) return null;
  try {
    const raw = storage?.getItem(storageKey(userId, media));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function safeDate(value: unknown, today: string): string | null {
  return typeof value === "string" && value !== "" && isAllowedLogDate(value, null, today) ? value : null;
}

export function readMovieLogPreferences(userId: string | null, isProfilePublic: boolean, storage = browserStorage(), today = istanbulToday()): MovieLogPreferences {
  const value = read(userId, "movie", storage);
  return { watchedOn: safeDate(value?.watchedOn, today), isPublic: isProfilePublic && value?.isPublic === true };
}

export function readGameLogPreferences(userId: string | null, isProfilePublic: boolean, storage = browserStorage(), today = istanbulToday()): GameLogPreferences {
  const value = read(userId, "game", storage);
  return {
    startedAt: safeDate(value?.startedAt, today),
    completedAt: safeDate(value?.completedAt, today),
    isPublic: isProfilePublic && value?.isPublic === true,
  };
}

function write(userId: string | null, media: "movie" | "game", value: MovieLogPreferences | GameLogPreferences, storage: StorageLike | undefined): void {
  if (!userId) return;
  try { storage?.setItem(storageKey(userId, media), JSON.stringify(value)); }
  catch { /* Storage may be unavailable or full. */ }
}

export function writeMovieLogPreferences(userId: string | null, value: MovieLogPreferences, storage = browserStorage()): void {
  write(userId, "movie", value, storage);
}

export function writeGameLogPreferences(userId: string | null, value: GameLogPreferences, storage = browserStorage()): void {
  write(userId, "game", value, storage);
}
