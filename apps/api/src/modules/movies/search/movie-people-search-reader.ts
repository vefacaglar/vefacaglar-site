import { inject, injectable } from "tsyringe";
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, type MeilisearchConfig } from "../../../shared/search/search.tokens";
import { reachablePage, searchFailureEvent, type ISearchClient, type MeilisearchSearchParams } from "../../../shared/search/meilisearch.client";
import { withTimeout } from "../../../shared/search/with-timeout";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";

export const MOVIE_PEOPLE_SEARCH_READER = Symbol("MoviePeopleSearchReader");
/** Stable Meilisearch index uid; the worker rebuilds it behind an index swap. */
export const MOVIE_PEOPLE_SEARCH_INDEX = "movie_people_en";
export type MoviePeopleSearchQuery = { collection: string; q: string; limit: number };
/** Person UUIDs in index order, or null when the index cannot answer (use SQL). */
export interface IMoviePeopleSearchReader { search(query: MoviePeopleSearchQuery): Promise<{ ids: string[] } | null> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The published people index the API may query (`movie_people_search_state.active_collection`). */
export function isOwnedMoviePeopleCollection(collection: string): boolean {
  return collection === MOVIE_PEOPLE_SEARCH_INDEX;
}
export function moviePeopleSearchParameters(query: MoviePeopleSearchQuery): MeilisearchSearchParams {
  if (!isOwnedMoviePeopleCollection(query.collection)) throw new Error("Invalid movie people search collection");
  // Relevance first; the index's last ranking rules (publicCreditCount:desc, nameSort:asc) break ties.
  return { q: query.q, attributesToSearchOn: ["name"], attributesToRetrieve: ["id"], page: 1, hitsPerPage: query.limit };
}

@injectable()
export class MeilisearchMoviePeopleSearchReader implements IMoviePeopleSearchReader {
  private retryAt = 0;
  constructor(@inject(SEARCH_CLIENT) private readonly client: ISearchClient,
    @inject(MEILISEARCH_CONFIG) private readonly config: MeilisearchConfig) {}
  async search(query: MoviePeopleSearchQuery) {
    if (!this.config.enabled || Date.now() < this.retryAt) return null;
    if (!/[\p{L}\p{N}]/u.test(query.q)) return { ids: [] };
    const controller = new AbortController();
    try {
      return await withTimeout(this.firstPage(query, controller.signal), 3000, "meilisearch.movie_people.search");
    } catch (error) {
      if (Date.now() >= this.retryAt) {
        this.retryAt = Date.now() + 30_000;
        const { event, level } = searchFailureEvent(error);
        reportRuntimeFailure(event, "Meilisearch movie people search failed. Using Postgres", error, level);
      }
      return null;
    } finally {
      controller.abort();
    }
  }

  private async firstPage(query: MoviePeopleSearchQuery, signal: AbortSignal) {
    const result = await this.client.search<{ id: string }>(query.collection, moviePeopleSearchParameters(query), { signal });
    const ids = result.hits?.map((hit) => hit.id) ?? [];
    const totalHits = result.totalHits as number;
    if (!Number.isSafeInteger(totalHits) || totalHits < 0 || ids.length > query.limit
      || ids.some((id) => !UUID.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error("Invalid movie people search page");
    }
    // A short first page is valid only when `pagination.maxTotalHits` caps it.
    if (await reachablePage(this.client, query.collection,
      { page: 1, hitsPerPage: query.limit, totalHits, count: ids.length }, { signal }) === null) {
      throw new Error("Invalid movie people search page");
    }
    return { ids };
  }
}
