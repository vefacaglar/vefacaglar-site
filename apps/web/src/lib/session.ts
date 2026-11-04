import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

/** The signed-in user for this request, or null. Memoized per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return null;
  try {
    const res = await httpClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return ((await res.json()) as { user: SessionUser }).user;
  } catch {
    return null;
  }
});

/** Guard for admin-only dashboard pages: redirects signed-out users to login and non-admins home. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");
  if (user.role !== "admin") redirect("/");
  return user;
}
