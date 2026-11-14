import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { httpClient } from "./httpClient";

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  /** Whether the user's library profile is visible to anyone with the link. */
  isProfilePublic: boolean;
};

/**
 * Lifetime of the `session_token` cookie. The API session behind it slides (it
 * expires after 7 idle days) up to this absolute lifetime, so the cookie must not
 * expire before the session does.
 */
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

type SessionLookup = { user: SessionUser } | { user: null; unavailable: boolean };

/**
 * Only a 401/403 means "signed out". An API or network failure is reported as
 * unavailable so callers can tell an outage from a logout. Memoized per request.
 */
const lookupSession = cache(async (): Promise<SessionLookup> => {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { user: null, unavailable: false };
  try {
    const res = await httpClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) return { user: null, unavailable: false };
    if (!res.ok) {
      console.error(`Session check failed with status ${res.status}.`);
      return { user: null, unavailable: true };
    }
    return { user: ((await res.json()) as { user: SessionUser }).user };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Session check failed:", error);
    return { user: null, unavailable: true };
  }
});

/** The signed-in user for this request, or null (also when the session cannot be checked right now). */
export async function getSessionUser(): Promise<SessionUser | null> {
  return (await lookupSession()).user;
}

/**
 * Guard for admin-only dashboard pages: redirects signed-out users to login and non-admins home.
 * Throws when the session cannot be checked, so an API outage shows an error instead of a logout.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await lookupSession();
  if (!session.user) {
    if (session.unavailable) throw new Error("The session could not be verified. Please try again.");
    redirect("/dashboard/login");
  }
  if (session.user.role !== "admin") redirect("/");
  return session.user;
}
