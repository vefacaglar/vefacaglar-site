import { cache } from "react";
import { cookies } from "next/headers";
import { httpClient } from "./httpClient";
import type { GameLogInput } from "../app/games/actions";

/** PUT `{ isProfilePublic }` here to make the signed-in user's profile public or private. */
export const PROFILE_VISIBILITY_PATH = "/api/auth/profile/visibility";

export type LibraryGame = {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  /** Status of the most recent log. */
  status: GameLogInput["status"];
  /** Rating of the most recent rated log. */
  rating: number | null;
  /** Playtime summed over all of this game's logs. */
  playtimeHours: number | null;
  logCount: number;
  lastLoggedAt: string;
  /** Latest completion date (YYYY-MM-DD), or null if never finished. */
  completedAt: string | null;
  /** ISO timestamp of the latest activity: a log created or updated, or playtime added. */
  lastActivityAt: string;
};

export type LibrarySummary = {
  gameCount: number;
  logCount: number;
  completedCount: number;
  playtimeHours: number;
  averageRating: number | null;
};

export type ProfileUser = { username: string; displayName: string; isProfilePublic: boolean };

export type ProfileLibrary = {
  user: ProfileUser;
  summary: LibrarySummary;
  games: LibraryGame[];
  /** The viewer is the profile's owner (decided by the API). */
  isOwner: boolean;
};

/**
 * Outcome of loading a profile for this viewer:
 * - `ok`: the library, visible to this viewer.
 * - `private`: the profile exists but is private; `signedIn` tells a signed-out
 *   visitor (who might be the owner) apart from someone signed in as another user.
 * - `not_found`: no such user, or the account is inactive.
 */
export type ProfileLibraryResult =
  | { kind: "ok"; data: ProfileLibrary }
  | { kind: "private"; signedIn: boolean }
  | { kind: "not_found" };

/**
 * A user's games library for their profile pages. The session token is sent when
 * present so owners can see their private profile. Memoized per request so the
 * profile layout, pages and metadata share one fetch.
 */
export const getProfileLibrary = cache(async (username: string): Promise<ProfileLibraryResult> => {
  const token = (await cookies()).get("session_token")?.value;
  const res = await httpClient.get(`/api/games/users/${encodeURIComponent(username)}/library`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (res.ok) return { kind: "ok", data: (await res.json()) as ProfileLibrary };
  if (res.status === 401) return { kind: "private", signedIn: false };
  if (res.status === 403) return { kind: "private", signedIn: true };
  if (res.status === 404) return { kind: "not_found" };
  throw new Error(`Profile library fetch failed: ${res.status}`);
});

/** Path of a user's profile, e.g. `/profile/vefa`. */
export function profilePath(username: string, sub?: "games" | "movies"): string {
  const base = `/profile/${encodeURIComponent(username)}`;
  return sub ? `${base}/${sub}` : base;
}

/** Route params may arrive encoded or not; decode once without throwing on stray `%`. */
export function decodeUsername(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
