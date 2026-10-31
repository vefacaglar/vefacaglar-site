import { cache } from "react";
import { cookies } from "next/headers";
import { httpClient } from "./httpClient";

export type SessionUser = { id: string; email: string; displayName: string; role: string };

/** The signed-in user for this request, or null. Memoized per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;
  try {
    const res = await httpClient.get("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return ((await res.json()) as { user: SessionUser }).user;
  } catch {
    return null;
  }
});
