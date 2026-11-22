import { cookies } from "next/headers";
import { httpClient } from "./httpClient";
export interface TvPreferences {
  rating: number | null;
  note: string | null;
  ratingVersion: number;
  noteVersion: number;
}
/** Private request only. A signed-in response is never shared or persisted in Next's cache. */
export async function getMyTvPreferences(id: number): Promise<TvPreferences | null> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return null;
  const response = await httpClient.get(`/api/tv-series/${id}/preferences`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`TV preferences fetch failed: ${response.status}`);
  return response.json() as Promise<TvPreferences>;
}
