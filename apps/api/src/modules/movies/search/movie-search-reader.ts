import { inject, injectable } from "tsyringe";
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, type MeilisearchConfig } from "../../../shared/search/search.tokens";
import { reachablePage, searchFailureEvent, type ISearchClient, type MeilisearchSearchParams } from "../../../shared/search/meilisearch.client";
import { withTimeout } from "../../../shared/search/with-timeout";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";

export const MOVIE_SEARCH_READER = Symbol("MovieSearchReader");
/** Stable Meilisearch index uid; the worker rebuilds it behind an index swap. */
export const MOVIE_SEARCH_INDEX = "movies_en";
export type MovieSearchQuery = { collection: string; q?: string; personQid?: string; page: number; limit: number; fresh: boolean };
export interface IMovieSearchReader { search(query: MovieSearchQuery): Promise<{ ids: string[]; total: number } | null> }
/** The published index the API may query (`movie_search_state.active_collection`). */
export function isOwnedMovieCollection(collection: string): boolean {
  return collection === MOVIE_SEARCH_INDEX;
}
export function movieSearchParameters(query: MovieSearchQuery): MeilisearchSearchParams {
  if (!isOwnedMovieCollection(query.collection)) throw new Error("Invalid movie search collection");
  if (query.personQid && !/^Q[1-9]\d*$/.test(query.personQid)) throw new Error("Invalid movie person filter");
  const typed = !!query.q?.trim();
  return {
    q: typed ? query.q : "", attributesToSearchOn: ["title", "originalTitle"], attributesToRetrieve: ["id"],
    page: query.page, hitsPerPage: query.limit,
    // Typed queries: the `sort` ranking rule follows words/typo/proximity/attribute, so
    // relevance comes first and these fields only break its ties.
    sort: typed
      ? query.fresh ? ["interestRecognitionRank:desc", "tieBreakId:asc"] : ["recognitionCount:desc", "tieBreakId:asc"]
      : query.fresh ? ["interestScore:desc", "titleSort:asc", "tieBreakId:asc"] : ["titleSort:asc", "tieBreakId:asc"],
    // The QID is validated above; quoting keeps it a plain string literal.
    ...(query.personQid ? { filter: `personQids = ${JSON.stringify(query.personQid)}` } : {}),
  };
}

@injectable()
export class MeilisearchMovieSearchReader implements IMovieSearchReader {
  private retryAt = 0;
  constructor(@inject(SEARCH_CLIENT) private readonly client: ISearchClient,
    @inject(MEILISEARCH_CONFIG) private readonly config: MeilisearchConfig) {}
  async search(query: MovieSearchQuery) {
    if (!this.config.enabled || Date.now() < this.retryAt) return null;
    const controller = new AbortController();
    try {
      // Punctuation-only input is not a browse wildcard (same as SQL fallback).
      if (query.q && !/[\p{L}\p{N}]/u.test(query.q)) return { ids: [], total: 0 };
      return await withTimeout(this.page(query, controller.signal), 3000, "meilisearch.movies.search");
    } catch (error) {
      if (Date.now() >= this.retryAt) {
        this.retryAt = Date.now() + 30_000;
        const { event, level } = searchFailureEvent(error);
        reportRuntimeFailure(event, "Meilisearch movie search failed. Using Postgres", error, level);
      }
      return null;
    } finally {
      controller.abort();
    }
  }

  /**
   * IDs plus the total a client may page through: `totalHits` capped at the
   * index's `pagination.maxTotalHits`, so a page past that cap is a valid empty
   * page rather than a corrupt one.
   */
  private async page(query: MovieSearchQuery, signal: AbortSignal) {
    const result = await this.client.search<{ id: string }>(query.collection, movieSearchParameters(query), { signal });
    const ids = result.hits?.map((hit) => hit.id) ?? [];
    const totalHits = result.totalHits as number;
    if (!Number.isSafeInteger(totalHits) || totalHits < 0 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error("Invalid movie search page");
    }
    const total = await reachablePage(this.client, query.collection,
      { page: query.page, hitsPerPage: query.limit, totalHits, count: ids.length }, { signal });
    if (total === null) throw new Error("Invalid movie search page");
    return { ids, total };
  }
}
