import type { MovieRanking } from "./popularity.types";
import { isSourceDay, utcDay } from "./wikipedia-interest";
import { type AudienceItem, type AudienceSnapshot, type AudienceScore, type AudienceSourceSummary, type NetflixCandidate } from "./audience.types";

export const AUDIENCE_WEIGHTS = { tmdb: 0.63, netflix: 0.27, wikipedia: 0.10 } as const;
const RANK_DAMPING = 10;
export function audienceContribution(provider: keyof typeof AUDIENCE_WEIGHTS, rank: number): number {
  return AUDIENCE_WEIGHTS[provider] * RANK_DAMPING / (RANK_DAMPING + rank - 1);
}
const DAY = 86_400_000;

export function dateAfter(day: string, days: number): string {
  if (!isSourceDay(day)) throw new Error("invalid_audience_date");
  return new Date(Date.parse(day + "T00:00:00Z") + days * DAY).toISOString();
}
export function audienceSourceFresh(source: Pick<AudienceSnapshot, "sourceDate" | "expiresAt">, now = new Date()): boolean {
  return isSourceDay(source.sourceDate) && source.sourceDate <= utcDay(now)
    && Number.isFinite(Date.parse(source.expiresAt)) && Date.parse(source.expiresAt) > now.getTime();
}
export function rankAudienceItems(items: Omit<AudienceItem, "rank">[]): AudienceItem[] {
  const sorted = [...items].sort((a, b) => b.value - a.value || a.externalId.localeCompare(b.externalId));
  let rank = 1;
  return sorted.map((item, index) => {
    if (index && item.value !== sorted[index - 1].value) rank = index + 1;
    return { ...item, rank };
  });
}
/** Fixed provider weights preserve missing evidence and let independent agreement matter. */
export function fuseAudience(snapshots: AudienceSnapshot[]): AudienceScore[] {
  const scores = new Map<string, { value: number; sourceMask: number }>();
  const masks = { tmdb: 1, netflix: 2, wikipedia: 4 };
  for (const source of snapshots) {
    const seen = new Set<string>();
    for (const item of [...source.items].sort((a, b) => a.rank - b.rank || a.externalId.localeCompare(b.externalId))) {
      if (!item.wikidataId || item.value <= 0 || seen.has(item.wikidataId)) continue;
      seen.add(item.wikidataId);
      const contribution = audienceContribution(source.provider, item.rank);
      const previous = scores.get(item.wikidataId) ?? { value: 0, sourceMask: 0 };
      scores.set(item.wikidataId, { value: previous.value + contribution, sourceMask: previous.sourceMask | masks[source.provider] });
    }
  }
  return [...scores].map(([wikidataId, score]) => ({ wikidataId, score: Math.round(score.value * 1_000_000), sourceMask: score.sourceMask }))
    .sort((a, b) => b.score - a.score || a.wikidataId.localeCompare(b.wikidataId));
}
export function audienceSummary(snapshot: AudienceSnapshot): AudienceSourceSummary {
  const { items, ...source } = snapshot;
  return { ...source, observedCount: items.length, matchedCount: items.filter((item) => !!item.wikidataId && item.value > 0).length };
}
export function audienceRanking(sources: AudienceSourceSummary[] | null, hasObservations: boolean, now = new Date()): MovieRanking {
  const contributing = sources?.filter((source) => source.matchedCount > 0) ?? [];
  const complete = contributing.length && contributing.every((source) => audienceSourceFresh(source, now));
  const core = contributing.filter((source) => source.provider !== "wikipedia");
  const isFresh = !!complete && hasObservations && core.length > 0;
  const mode = !isFresh ? "recognition" : contributing.length > 1 ? "combined_popularity"
    : core[0].provider === "tmdb" ? "tmdb_popularity" : "netflix_views";
  return { mode, sourceDate: sources?.map((source) => source.sourceDate).sort().at(-1) ?? null,
    sourceUrl: null, isFresh, sources: sources ?? [] };
}
export function exactAudienceTitle(title: string): string {
  return title.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}
/** A same-named remake never wins by title similarity or result order. */
export function matchNetflixCandidate(item: AudienceItem, candidates: NetflixCandidate[], verifiedIds: Set<string>): string | null {
  const matching = new Set(candidates.filter((candidate) => exactAudienceTitle(candidate.title) === exactAudienceTitle(item.title)
    && (candidate.runtimeMinutes !== null
      ? item.runtimeMinutes !== undefined && Math.abs(candidate.runtimeMinutes - item.runtimeMinutes) <= 3
      : !!candidate.netflixId && verifiedIds.has(candidate.netflixId)))
    .map((candidate) => candidate.wikidataId));
  return matching.size === 1 ? [...matching][0] : null;
}
