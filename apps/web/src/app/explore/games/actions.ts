"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../../lib/httpClient";

export type GameLogInput = {
  status: "backlog" | "playing" | "completed" | "on_hold" | "abandoned";
  platformId: string | null;
  rating: number | null;
  startedAt: string | null;
  completedAt: string | null;
  playtimeHours: number | null;
  notes: string | null;
};

type Result = { id?: string; error?: string };

// Log changes only affect the signed-in user's own view of one game page, so
// they revalidate that path instead of the site-wide public content tag.
async function send(method: "POST" | "PUT" | "DELETE", path: string, slug: string, body?: GameLogInput): Promise<Result> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { error: "Please sign in again." };
  const headers = { Authorization: `Bearer ${token}` };

  let createdId: string | undefined;
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
    if (method === "POST") {
      const data = await res.json().catch(() => null);
      if (typeof data?.id === "string") createdId = data.id;
    }
  } catch (error) {
    console.error(`Game log action failed (${method} ${path}):`, error);
    return { error: "Server connection error." };
  }

  revalidatePath(`/explore/games/${slug}`, "layout");
  return createdId ? { id: createdId } : {};
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
