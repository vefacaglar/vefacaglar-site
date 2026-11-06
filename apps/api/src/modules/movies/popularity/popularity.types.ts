export const MOVIE_POPULARITY_REPOSITORY = Symbol("MoviePopularityRepository");
export const WIKIPEDIA_INTEREST_CLIENT = Symbol("WikipediaInterestClient");
export const MOVIE_POPULARITY_SOURCE_ID = "enwiki-top-articles-v1";
export type InterestArticle = { title: string; views: number };
export type InterestProjection = {
  sourceDate: string; observations: { wikidataId: string; views: number }[];
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
export type MovieRanking = { mode: "wikipedia_interest" | "alphabetical"; sourceDate: string | null; sourceUrl: string | null; isFresh: boolean };
export interface IMoviePopularityRepository {
  state(): Promise<MoviePopularityState>;
  wikidataCooldown(): Promise<Date | null>;
  publish(projection: InterestProjection): Promise<{ status: "published" | "unchanged"; observedMovieCount: number }>;
  recordFailure(code: string, provider: "aqs" | "wikidata", retryAt: Date): Promise<void>;
}
export interface IWikipediaInterestClient {
  collect(afterDate: string | null, options: { now?: Date; signal?: AbortSignal; beforeWikidata: () => Promise<Date | null> }): Promise<InterestCollection>;
}
export class MovieInterestSourceError extends Error {
  constructor(public readonly provider: "aqs" | "wikidata", public readonly code: string, public readonly retryAt: Date = new Date(Date.now() + 60_000), public readonly status?: number) { super(code); }
}
