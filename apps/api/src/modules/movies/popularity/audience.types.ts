export const MOVIE_AUDIENCE_REPOSITORY = Symbol("MovieAudienceRepository");
export const MOVIE_AUDIENCE_CLIENT = Symbol("MovieAudienceClient");
export const MOVIE_AUDIENCE_SOURCE_ID = "movie-audience-v1";
export const AUDIENCE_PROVIDERS = ["tmdb", "netflix", "wikipedia"] as const;
export type AudienceProvider = typeof AUDIENCE_PROVIDERS[number];

export type AudienceItem = {
  externalId: string;
  title: string;
  value: number;
  rank: number;
  runtimeMinutes?: number;
  wikidataId?: string;
};
export type AudienceSnapshot = {
  provider: AudienceProvider;
  sourceDate: string;
  windowStart: string;
  expiresAt: string;
  sourceUrl: string;
  items: AudienceItem[];
};
export type AudienceSourceSummary = Omit<AudienceSnapshot, "items"> & { observedCount: number; matchedCount: number };
export type AudienceSourceState = {
  provider: AudienceProvider;
  snapshot: AudienceSnapshot | null;
  cooldownUntil: Date | null;
  errorCode: string | null;
};
export type AudienceIdentity = { provider: "tmdb" | "netflix"; externalId: string; wikidataId: string | null; checkedAt: Date };
export type AudienceScore = { wikidataId: string; score: number; sourceMask: number };
export type NetflixCandidate = { wikidataId: string; title: string; runtimeMinutes: number | null; netflixId: string | null };

export interface IMovieAudienceClient {
  tmdb(now: Date): Promise<AudienceSnapshot>;
  netflix(now: Date): Promise<AudienceSnapshot>;
  tmdbIdentities(ids: string[], beforeWikidata: () => Promise<void>): Promise<Map<string, string | null>>;
  netflixIdentities(items: AudienceItem[], beforeWikidata: () => Promise<void>): Promise<Map<string, string | null>>;
}
export interface IMovieAudienceRepository {
  sources(): Promise<AudienceSourceState[]>;
  identities(provider: "tmdb" | "netflix", externalIds: string[], after: Date): Promise<AudienceIdentity[]>;
  saveIdentities(identities: AudienceIdentity[]): Promise<void>;
  accept(snapshot: AudienceSnapshot): Promise<void>;
  failure(provider: AudienceProvider, code: string, retryAt: Date): Promise<void>;
  wikidataCooldown(): Promise<Date | null>;
  deferWikidata(retryAt: Date): Promise<void>;
  wikipedia(): Promise<AudienceSnapshot | null>;
  publish(snapshots: AudienceSnapshot[], scores: AudienceScore[], now: Date): Promise<{ status: "published" | "unchanged"; observedMovieCount: number }>;
}
export class MovieAudienceError extends Error {
  constructor(public readonly code: string, public readonly retryAt = new Date(Date.now() + 60_000), public readonly wikidata = false) {
    super(code);
  }
}
