import { httpClient } from "./httpClient";

export type CommunityEntry = {
  id: string;
  author: { username: string; displayName: string };
  sharedAt: string;
  text: string | null;
  rating: number | null;
  status?: "backlog" | "playing" | "completed" | "on_hold" | "abandoned";
  startedAt?: string | null;
  completedAt?: string | null;
  watchedOn?: string;
};

export type CommunityPage = {
  rating: { average: number | null; count: number; scale: 10 | 100 };
  entries: CommunityEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getCommunity(kind: "games" | "movies", slug: string, page: number): Promise<CommunityPage> {
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  const response = await httpClient.get(`/api/${kind}/${encodeURIComponent(slug)}/community?${params}`);
  if (!response.ok) throw new Error(`Community fetch failed: ${response.status}`);
  return response.json();
}

export function communityPageNumber(value?: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1;
}

export function communityPageHref(path: string, params: Record<string, string | undefined>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "communityPage" && value) query.set(key, value);
  }
  if (page > 1) query.set("communityPage", String(page));
  const suffix = query.toString();
  return `${path}${suffix ? `?${suffix}` : ""}#community`;
}
