export const MOVIE_POPULARITY_REPOSITORY = Symbol("MoviePopularityRepository");
export const WIKIPEDIA_INTEREST_CLIENT = Symbol("WikipediaInterestClient");
export const MOVIE_INTEREST_SOURCE_URL = "https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html";
export const MOVIE_POPULARITY_SOURCE_ID = "enwiki-current-interest-v2";
export type InterestArticle = { title: string; views: number };
export type InterestCandidate = { wikidataId: string; article: string };
export type InterestObservation = { wikidataId: string; views: number };
export type InterestProjection = {
  sourceDate: string; observations: InterestObservation[];
  rollingObservations: InterestObservation[];
  additionalObservationCount?: number;
  additionalErrorCode?: string;
  additionalRetryAt?: string;
  articleCount: number; mappedArticleCount: number; missingArticleCount: number; duplicateQidCount: number;
  requests: number; durationMs: number;
};
export type InterestCollection = { status: "complete"; projection: InterestProjection }
  | { status: "delayed"; requests: number; durationMs: number };
export type MoviePopularityState = {
  sourceDate: string | null; publishedAt: Date | null; cooldownUntil: Date | null;
  failureCount: number; lastAttemptAt: Date | null; errorCode: string | null;
  articleCount: number | null; mappedArticleCount: number | null; missingArticleCount: number | null;
  duplicateQidCount: number | null; observedMovieCount: number | null;
};
export type MovieRanking = { mode: "wikipedia_interest" | "recognition" | "alphabetical"; sourceDate: string | null; sourceUrl: string | null; isFresh: boolean; windowDays?: 3 };
export interface IMoviePopularityRepository {
  state(): Promise<MoviePopularityState>;
  wikidataCooldown(): Promise<Date | null>;
  interestCandidates(now: Date): Promise<InterestCandidate[]>;
  knownMovieQids(qids: string[]): Promise<string[]>;
  publish(projection: InterestProjection): Promise<{ status: "published" | "unchanged"; observedMovieCount: number }>;
  recordFailure(code: string, provider: "aqs" | "wikidata", retryAt: Date): Promise<void>;
}
export interface IWikipediaInterestClient {
  collect(afterDate: string | null, options: { now?: Date; signal?: AbortSignal; candidates?: InterestCandidate[]; knownMovieQids: (qids: string[]) => Promise<string[]>; beforeWikidata: () => Promise<Date | null> }): Promise<InterestCollection>;
}
export class MovieInterestSourceError extends Error {
  constructor(public readonly provider: "aqs" | "wikidata", public readonly code: string, public readonly retryAt: Date = new Date(Date.now() + 60_000), public readonly status?: number) { super(code); }
}
