import type { TvIdentity } from "./tv-popularity.types";
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2147483647;
export function parseTvIdentities(raw: unknown): TvIdentity[] {
  if (!Array.isArray(raw) || raw.length < 1000 || raw.length > 100000) throw new Error("tv_identity_snapshot_incomplete");
  const rows = raw as TvIdentity[];
  if (rows.some((row) => !row || !positiveId(row.seriesId) || !positiveId(row.tmdbId) || (row.article !== null && (typeof row.article !== "string" || !row.article || row.article.length > 500)))) throw new Error("tv_identity_snapshot_invalid");
  const bySeries = new Map<number, Set<number>>(), byTmdb = new Map<number, Set<number>>(), byArticle = new Map<string, Set<number>>();
  for (const row of rows) {
    bySeries.set(row.seriesId, (bySeries.get(row.seriesId) ?? new Set()).add(row.tmdbId));
    byTmdb.set(row.tmdbId, (byTmdb.get(row.tmdbId) ?? new Set()).add(row.seriesId));
    if (row.article) byArticle.set(row.article, (byArticle.get(row.article) ?? new Set()).add(row.seriesId));
  }
  const unique = new Map<number, TvIdentity>();
  for (const row of rows) {
    if (bySeries.get(row.seriesId)!.size !== 1 || byTmdb.get(row.tmdbId)!.size !== 1) continue;
    const old = unique.get(row.seriesId);
    const article = row.article && byArticle.get(row.article)!.size === 1 ? row.article : null;
    // Conflicting sitelinks cannot contribute Wikipedia interest.
    unique.set(row.seriesId, { ...row, article: old && old.article !== article ? null : article });
  }
  if (unique.size < 1000) throw new Error("tv_identity_snapshot_incomplete");
  return [...unique.values()].sort((a, b) => a.seriesId - b.seriesId);
}
export function rankTvPopularity(identities: TvIdentity[], tmdb: Map<number, number>, wiki: Map<string, number>) {
  return identities.flatMap((identity) => {
    const value = tmdb.get(identity.tmdbId);
    if (value === undefined) return [];
    const views = identity.article ? wiki.get(identity.article) ?? 0 : 0;
    // TMDB daily popularity is the base; sparse recent top-page interest only
    // adds a bounded corroborating bonus. Missing Top1000 observations do not penalize.
    return [{ seriesId: identity.seriesId, score: Math.log1p(value) + Math.min(2, Math.log1p(views) / 10) }];
  });
}
