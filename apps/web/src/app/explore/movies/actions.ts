"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../../lib/httpClient";
import { getSessionUser } from "../../../lib/session";
export type MovieActionResult = { error?: string; uncertain?: boolean };
async function send(method: "POST" | "PUT" | "DELETE", slug: string, suffix: string, body?: unknown): Promise<MovieActionResult> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { error: "Please sign in again." };
  const path = `/api/movies/${encodeURIComponent(slug)}/${suffix}`;
  const options = { headers: { Authorization: `Bearer ${token}` } };
  try {
    const response = method === "POST" ? await httpClient.post(path, body, options) : method === "PUT" ? await httpClient.put(path, body, options) : await httpClient.delete(path, options);
    if (!response.ok) { const data = await response.json().catch(() => ({})); return { error: data.message || "Request failed.", uncertain: response.status >= 500 }; }
  } catch { return { error: "Server connection error.", uncertain: true }; }
  revalidatePath(`/explore/movies/${slug}`, "layout");
  const user = await getSessionUser();
  if (user) revalidatePath(`/profile/${encodeURIComponent(user.username)}`, "layout");
  return {};
}
/** The caller keeps the same UUID when retrying one intended watch. */
export async function createMovieWatch(slug: string, id: string, watchedOn: string, comment: string | null): Promise<MovieActionResult> { return send("POST", slug, "watches", { id, watchedOn, comment }); }
export async function updateMovieWatch(slug: string, id: string, watchedOn: string, comment: string | null): Promise<MovieActionResult> { return send("PUT", slug, `watches/${encodeURIComponent(id)}`, { watchedOn, comment }); }
export async function deleteMovieWatch(slug: string, id: string): Promise<MovieActionResult> { return send("DELETE", slug, `watches/${encodeURIComponent(id)}`); }
export async function setMovieRating(slug: string, rating: number | null): Promise<MovieActionResult> { return send("PUT", slug, "rating", { rating }); }
