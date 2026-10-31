"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../lib/httpClient";

export type GameLogInput = {
  status: "backlog" | "playing" | "completed" | "on_hold" | "abandoned";
  platformId: string | null;
  rating: number | null;
  startedAt: string | null;
  completedAt: string | null;
  playtimeHours: number | null;
  notes: string | null;
};

type Result = { error?: string };

// Log changes only affect the signed-in user's own view of one game page, so
// they revalidate that path instead of the site-wide public content tag.
async function send(method: "POST" | "PUT" | "DELETE", path: string, slug: string, body?: GameLogInput): Promise<Result> {
  const token = cookies().get("session_token")?.value;
  if (!token) return { error: "Please sign in again." };
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const res =
      method === "POST"
        ? await httpClient.post(path, body, { headers })
        : method === "PUT"
          ? await httpClient.put(path, body, { headers })
          : await httpClient.delete(path, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Request failed." };
    }
  } catch (error) {
    console.error(`Game log action failed (${method} ${path}):`, error);
    return { error: "Server connection error." };
  }

  revalidatePath(`/games/${slug}`);
  return {};
}

export async function createGameLog(slug: string, input: GameLogInput): Promise<Result> {
  return send("POST", `/api/games/${encodeURIComponent(slug)}/logs`, slug, input);
}

export async function updateGameLog(slug: string, id: string, input: GameLogInput): Promise<Result> {
  return send("PUT", `/api/games/logs/${encodeURIComponent(id)}`, slug, input);
}

export async function deleteGameLog(slug: string, id: string): Promise<Result> {
  return send("DELETE", `/api/games/logs/${encodeURIComponent(id)}`, slug);
}
