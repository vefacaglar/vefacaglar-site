import type { WikipediaAudience } from "./popularity-score";

export function wikipediaGameArticle(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !["en.wikipedia.org", "en.m.wikipedia.org"].includes(url.hostname)
      || url.port || url.username || url.password || !url.pathname.startsWith("/wiki/")) return null;
    const article = decodeURIComponent(url.pathname.slice(6)).replace(/ /g, "_").normalize("NFC");
    if (!article || article.length > 1000 || /[\u0000-\u001f]/.test(article)
      || /^(?:Special|User|Talk|File|Category|Template|Help|Wikipedia|Media):/i.test(article)) return null;
    return article;
  } catch { return null; }
}

export function completedGameAudienceDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)).toISOString().slice(0, 10);
}

export function gameAudienceWindow(day: string): string[] {
  const end = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== day) throw new Error("Invalid audience source day");
  return Array.from({ length: 35 }, (_, index) => new Date(end - (34 - index) * 86_400_000).toISOString().slice(0, 10));
}

export function gameAudienceUrl(article: string, day: string): URL {
  const days = gameAudienceWindow(day);
  const stamp = (value: string) => `${value.replace(/-/g, "")}00`;
  return new URL(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/${encodeURIComponent(article)}/daily/${stamp(days[0])}/${stamp(day)}`);
}

/** Only a complete, exactly dated human-view window can replace a prior observation. */
export function parseGameAudience(raw: unknown, article: string, day: string): WikipediaAudience {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length !== 35) throw new Error("Incomplete game audience window");
  const days = gameAudienceWindow(day);
  const byDay = new Map<string, number>();
  for (const item of items) {
    const value = item as Record<string, unknown>;
    const stamp = typeof value?.timestamp === "string" ? value.timestamp : "";
    const sourceDay = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
    if (!/^\d{8}00$/.test(stamp) || !days.includes(sourceDay) || byDay.has(sourceDay)
      || value.project !== "en.wikipedia" || value.access !== "all-access" || value.agent !== "user" || value.granularity !== "daily"
      || typeof value.article !== "string" || value.article.replace(/ /g, "_").normalize("NFC") !== article
      || !Number.isSafeInteger(value.views) || Number(value.views) < 0) throw new Error("Invalid game audience observation");
    byDay.set(sourceDay, Number(value.views));
  }
  const sum = (selected: string[]) => selected.reduce((total, date) => total + byDay.get(date)!, 0);
  const currentViews = sum(days.slice(-7));
  const baselineViews = sum(days.slice(0, -7));
  if (!Number.isSafeInteger(currentViews) || !Number.isSafeInteger(baselineViews)) throw new Error("Game audience totals are too large");
  return { sourceDate: day, currentViews, baselineViews };
}

export function freshGameAudience(audience: WikipediaAudience, now: Date): boolean {
  const day = Date.parse(`${audience.sourceDate}T00:00:00Z`);
  return Number.isFinite(day) && audience.sourceDate === new Date(day).toISOString().slice(0, 10)
    && day < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    && day >= now.getTime() - 72 * 60 * 60 * 1000
    && Number.isSafeInteger(audience.currentViews) && audience.currentViews >= 0
    && Number.isSafeInteger(audience.baselineViews) && audience.baselineViews >= 0;
}
