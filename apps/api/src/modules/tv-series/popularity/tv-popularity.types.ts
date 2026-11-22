import type { TvPopularitySource } from "./tv-ranking";
export const TV_POPULARITY_REPOSITORY = Symbol("TvPopularityRepository");
export type TvIdentity = { seriesId: number; tmdbId: number; article: string | null };
export type TvPopularitySnapshot = { scores: { seriesId: number; score: number }[]; sources: TvPopularitySource[]; providerRows: number; mapped: number; wikiMatches: number };
export interface ITvPopularityRepository {
  state(): Promise<{ identityMap: unknown; identitiesCheckedAt: Date | null; cooldownUntil: Date | null }>;
  identities(rows: TvIdentity[], at: Date): Promise<void>;
  publish(snapshot: TvPopularitySnapshot, at: Date): Promise<{ generation: number; matched: number; queued: number }>;
  cooldown(until: Date): Promise<void>;
}
