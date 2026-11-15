import { inject, injectable } from "tsyringe";
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, type MeilisearchConfig } from "../../../shared/search/search.tokens";
import { MeilisearchError, reachablePage, searchFailureEvent, type ISearchClient, type MeilisearchSearchParams } from "../../../shared/search/meilisearch.client";
import { withTimeout } from "../../../shared/search/with-timeout";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";
import { splitMovieYearQuery } from "../movie-search-year";

export const MOVIE_SEARCH_READER = Symbol("MovieSearchReader");
/** Stable Meilisearch index uid; the worker rebuilds it behind an index swap. */
export const MOVIE_SEARCH_INDEX = "movies_en";
export type MovieSearchQuery = { collection: string; q?: string; personQid?: string; page: number; limit: number; fresh: boolean };
export interface IMovieSearchReader { search(query: MovieSearchQuery): Promise<{ ids: string[]; total: number } | null> }
/** The published index the API may query (`movie_search_state.active_collection`). */
export function isOwnedMovieCollection(collection: string): boolean {
  return collection === MOVIE_SEARCH_INDEX;
}
const TITLE_ATTRIBUTES = ["title", "originalTitle"];
/**
 * `matchYear` also searches `releaseYear`, so for "rango 2011" the `words` rule
 * ranks Rango (2011) above the other Rango matches that the default `last`
 * matching strategy still returns. A year-only query ("1917") stays a title search.
 */
export function movieSearchParameters(query: MovieSearchQuery, matchYear = !!splitMovieYearQuery(query.q)): MeilisearchSearchParams {
  if (!isOwnedMovieCollection(query.collection)) throw new Error("Invalid movie search collection");
  if (query.personQid && !/^Q[1-9]\d*$/.test(query.personQid)) throw new Error("Invalid movie person filter");
  const typed = !!query.q?.trim();
  return {
    q: typed ? query.q : "", attributesToSearchOn: typed && matchYear ? [...TITLE_ATTRIBUTES, "releaseYear"] : TITLE_ATTRIBUTES,
    attributesToRetrieve: ["id"],
    page: query.page, hitsPerPage: query.limit,
    // Typed queries: the `sort` ranking rule follows words/typo/proximity/wordPosition
    // (no attribute or exactness), so relevance comes first and these fields only break its ties.
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
      return await withTimeout(this.yearRankedPage(query, controller.signal), 3000, "meilisearch.movies.search");
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
   * An index built before `releaseYear` was searchable rejects it in
   * `attributesToSearchOn`; until the rebuilt index is swapped in, search the
   * title words alone rather than opening the outage window.
   */
  private async yearRankedPage(query: MovieSearchQuery, signal: AbortSignal) {
    const split = splitMovieYearQuery(query.q);
    if (!split) return this.page(query, signal, false);
    try {
      return await this.page(query, signal, true);
    } catch (error) {
      if (!(error instanceof MeilisearchError && error.code === "invalid_search_attributes_to_search_on")) throw error;
      return this.page({ ...query, q: split.words }, signal, false);
    }
  }

  /**
   * IDs plus the total a client may page through: `totalHits` capped at the
   * index's `pagination.maxTotalHits`, so a page past that cap is a valid empty
   * page rather than a corrupt one.
   */
  private async page(query: MovieSearchQuery, signal: AbortSignal, matchYear: boolean) {
    const result = await this.client.search<{ id: string }>(query.collection, movieSearchParameters(query, matchYear), { signal });
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
