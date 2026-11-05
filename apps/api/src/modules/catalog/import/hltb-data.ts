import { normalizeTitle, type HltbPopularityGame } from "./import.types";
import type { PopularitySource } from "../games.repository.interface";

const BASE_URL = "https://howlongtobeat.com";

export function hltbApiPath(script: string): string | null {
  const path = /fetch\s*\(\s*["'](\/api\/[a-zA-Z0-9_/-]+)["']\s*,\s*\{[^}]*method\s*:\s*["']POST["']/i.exec(script)?.[1];
  return path && !path.includes("..") && !path.endsWith("/init") ? path.replace(/\/$/, "") : null;
}

/** Only site-owned Next.js scripts can supply the public search path. */
export function hltbScriptUrls(html: string): string[] {
  const urls = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        const url = new URL(match[1], BASE_URL);
        return url.origin === BASE_URL && url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js") ? url.href : null;
      } catch { return null; }
    })
    .filter((url): url is string => url !== null);
  return [...new Set(urls)].sort((a, b) => Number(/pages\/|search/.test(b)) - Number(/pages\/|search/.test(a))).slice(0, 6);
}

export type HltbSession = { token: string; key: string | null; value: string | number | null };

export function parseHltbSession(raw: unknown): HltbSession {
  if (!isObject(raw) || typeof raw.token !== "string" || !raw.token.trim()) throw new Error("HLTB returned an invalid session");
  const key = Object.entries(raw).find(([name, value]) => /key/i.test(name) && typeof value === "string")?.[1];
  const value = Object.entries(raw).find(([name, value]) => /val/i.test(name) && (typeof value === "string" || typeof value === "number"))?.[1];
  return {
    token: raw.token,
    key: typeof key === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(key) ? key : null,
    value: typeof value === "string" || typeof value === "number" ? value : null,
  };
}

export function parseHltbGames(raw: unknown): HltbPopularityGame[] {
  if (!isObject(raw) || !Array.isArray(raw.data)) throw new Error("HLTB returned an invalid game list");
  return raw.data.flatMap((row): HltbPopularityGame[] => {
    if (!isObject(row) || !positiveInteger(row.game_id) || typeof row.game_name !== "string" || !row.game_name.trim()) return [];
    if (row.game_type != null && row.game_type !== "game") return [];
    return [{
      hltbId: row.game_id as number,
      title: row.game_name,
      releaseYear: releaseYear(row.release_world),
      completed: count(row.count_comp), backlog: count(row.count_backlog), playing: count(row.count_playing),
      times: { mainHours: toHours(row.comp_main), mainExtraHours: toHours(row.comp_plus), completionistHours: toHours(row.comp_100) },
    }];
  });
}

/** Reject ambiguous names and mismatched release years; a previously verified id takes precedence. */
export function matchHltbGames(sources: PopularitySource[], entries: HltbPopularityGame[]): Map<string, HltbPopularityGame> {
  const matches = new Map<string, HltbPopularityGame>();
  const rejected = new Set<string>();
  const ids = new Map(sources.filter((s) => s.hltb).map((s) => [s.hltb!.hltbId, s]));
  const names = new Map<string, PopularitySource[]>();
  for (const source of sources) {
    for (const title of new Set([source.title, source.originalTitle].filter((t): t is string => !!t).map(normalizeTitle))) {
      if (title) names.set(title, [...(names.get(title) ?? []), source]);
    }
  }
  for (const entry of entries) {
    const known = ids.get(entry.hltbId);
    const candidates = known ? [known] : (names.get(normalizeTitle(entry.title)) ?? []).filter((source) =>
      (!source.hltb || source.hltb.hltbId === entry.hltbId) && sameYear(source, entry)
    );
    if (candidates.length !== 1) continue;
    const source = candidates[0];
    if (rejected.has(source.id) || !sameYear(source, entry)) continue;
    if (matches.has(source.id) && matches.get(source.id)!.hltbId !== entry.hltbId) {
      matches.delete(source.id); rejected.add(source.id); continue;
    }
    matches.set(source.id, entry);
  }
  return matches;
}

export function hltbEngagement(snapshot: { completed: number | null; backlog: number | null; playing: number | null; updatedAt?: Date | null } | null, now = new Date()): number | null {
  if (!snapshot) return null;
  // Keep the stable match and last good data, but don't rank games on indefinitely stale counts.
  if (snapshot.updatedAt && now.getTime() - snapshot.updatedAt.getTime() > 7 * 24 * 60 * 60_000) return null;
  const counts = [snapshot.completed, snapshot.backlog, snapshot.playing].filter((v): v is number => v !== null && Number.isSafeInteger(v) && v >= 0);
  return counts.length ? counts.reduce((sum, value) => sum + value, 0) : null;
}

function sameYear(source: PopularitySource, entry: HltbPopularityGame): boolean {
  return !source.releaseDate || !entry.releaseYear || Number(source.releaseDate.slice(0, 4)) === entry.releaseYear;
}
function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function positiveInteger(value: unknown): boolean { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647; }
function count(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null; }
function releaseYear(value: unknown): number | null {
  const year = Number(String(value ?? "").slice(0, 4));
  return Number.isInteger(year) && year >= 1950 && year <= 2200 ? year : null;
}
function toHours(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 359_999_640 ? Math.round(value / 360) / 10 : null;
}
