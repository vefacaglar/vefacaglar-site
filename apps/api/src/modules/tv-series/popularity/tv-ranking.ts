export type TvPopularitySource = { provider: string; sourceDate: string; windowStart: string; expiresAt: string; sourceUrl: string };
const validDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function tvRankingMetadata(raw: unknown, now = new Date()): {
  mode: "current_popularity" | "alphabetical"; isFresh: boolean; sources: TvPopularitySource[];
} {
  const sources = Array.isArray(raw) ? raw.filter((source): source is TvPopularitySource => !!source &&
    typeof source.provider === "string" && validDay(source.sourceDate) &&
    validDay(source.windowStart) && typeof source.expiresAt === "string" && typeof source.sourceUrl === "string") : [];
  const isFresh = sources.length > 0 && sources.length === (Array.isArray(raw) ? raw.length : 0) && sources.every((source) => source.windowStart <= source.sourceDate && source.sourceDate <= now.toISOString().slice(0, 10) &&
    Number.isFinite(Date.parse(source.expiresAt)) && Date.parse(source.expiresAt) > now.getTime());
  return { mode: isFresh ? "current_popularity" : "alphabetical", isFresh, sources };
}
