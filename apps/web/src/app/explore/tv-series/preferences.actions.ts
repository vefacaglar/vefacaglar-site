"use server";
import { cookies } from "next/headers";
import { httpClient } from "../../../lib/httpClient";
import type { TvPreferences } from "../../../lib/tvPreferences";
export type TvPreferenceActionResult = { preferences?: TvPreferences; error?: string; conflict?: boolean };
async function send(id: number, field: "rating" | "note", value: number | string | null, expectedVersion: number): Promise<TvPreferenceActionResult> {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return { error: "This TV series is unavailable." };
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || expectedVersion > 2147483646) return { error: "Reload your saved preferences before trying again." };
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { error: "Please sign in again to save your rating and note." };
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const response = await httpClient.put(`/api/tv-series/${id}/preferences/${field}`, { [field]: value, expectedVersion }, { headers });
    if (response.ok) return { preferences: await response.json() as TvPreferences };
    if (response.status === 409) {
      const latest = await httpClient.get(`/api/tv-series/${id}/preferences`, { headers, cache: "no-store" });
      if (!latest.ok) return { error: `Your ${field} changed in another tab. The saved value could not be reloaded. Your draft is preserved. Try saving again.` };
      return { error: `Your ${field} changed in another tab. Your draft is preserved. Review the saved value before saving again.`,
        conflict: true, preferences: await latest.json() as TvPreferences };
    }
    if (response.status === 401) return { error: "Please sign in again to save your rating and note." };
    if (response.status === 404) return { error: "This TV series is unavailable." };
    if (response.status === 400) return { error: field === "rating" ? "Choose a whole-number rating from 1 to 10." : "Your note must be 2,000 characters or fewer." };
    return { error: "Your change could not be confirmed. Your draft is preserved. Try saving again." };
  } catch {
    return { error: "The server could not be reached. Your draft is preserved. Try saving again." };
  }
}
export async function setTvPersonalRating(id: number, rating: number | null, expectedVersion: number): Promise<TvPreferenceActionResult> {
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) return { error: "Choose a whole-number rating from 1 to 10." };
  return send(id, "rating", rating, expectedVersion);
}
export async function setTvPersonalNote(id: number, note: string | null, expectedVersion: number): Promise<TvPreferenceActionResult> {
  if (note !== null && (typeof note !== "string" || note.length > 2000)) return { error: "Your note must be 2,000 characters or fewer." };
  return send(id, "note", note?.trim() || null, expectedVersion);
}
