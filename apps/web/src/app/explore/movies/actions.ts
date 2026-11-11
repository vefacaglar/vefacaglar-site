"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../../lib/httpClient";
import { getSessionUser } from "../../../lib/session";
import { getActiveLanguage } from "../../../lib/lang";
import { movieActionConnectionError, movieActionError } from "./movieActionErrors";
export type MovieActionResult = { error?: string; uncertain?: boolean };
async function send(method: "POST" | "PUT" | "DELETE", slug: string, suffix: string, body?: unknown): Promise<MovieActionResult> {
  const lang = await getActiveLanguage();
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { error: lang === "tr" ? "Lütfen tekrar giriş yap." : "Please sign in again." };
  const path = `/api/movies/${encodeURIComponent(slug)}/${suffix}`;
  const options = { headers: { Authorization: `Bearer ${token}` } };
  try {
    const response = method === "POST" ? await httpClient.post(path, body, options) : method === "PUT" ? await httpClient.put(path, body, options) : await httpClient.delete(path, options);
    if (!response.ok) { const data = await response.json().catch(() => ({})); return { error: movieActionError(response.status, data.message, lang), uncertain: response.status >= 500 }; }
  } catch { return { error: movieActionConnectionError(lang), uncertain: true }; }
  revalidatePath(`/explore/movies/${slug}`, "layout");
  const user = await getSessionUser();
  if (user) revalidatePath(`/profile/${encodeURIComponent(user.username)}`, "layout");
  return {};
}
/** The caller keeps the same UUID when retrying one intended watch. */
export async function createMovieWatch(slug: string, id: string, watchedOn: string | null, comment: string | null, isPublic: boolean): Promise<MovieActionResult> { return send("POST", slug, "watches", { id, watchedOn, comment, isPublic }); }
export async function updateMovieWatch(slug: string, id: string, watchedOn: string | null, comment: string | null, isPublic: boolean): Promise<MovieActionResult> { return send("PUT", slug, `watches/${encodeURIComponent(id)}`, { watchedOn, comment, isPublic }); }
export async function deleteMovieWatch(slug: string, id: string): Promise<MovieActionResult> { return send("DELETE", slug, `watches/${encodeURIComponent(id)}`); }
export async function setMovieRating(slug: string, rating: number | null): Promise<MovieActionResult> { return send("PUT", slug, "rating", { rating }); }
