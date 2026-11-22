import { inject, injectable } from "tsyringe";
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, type MeilisearchConfig } from "../../../shared/search/search.tokens";
import { reachablePage, searchFailureEvent, type ISearchClient } from "../../../shared/search/meilisearch.client";
import { withTimeout } from "../../../shared/search/with-timeout";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";
import type { TvSeriesFilter } from "../tv-series.repository.interface";
export const TV_SERIES_SEARCH_READER = Symbol("TvSeriesSearchReader");
export const TV_SERIES_SEARCH_INDEX = "tv_series_en";
export interface ITvSeriesSearchReader {
  search(query: TvSeriesFilter & { fresh: boolean }): Promise<{ ids: number[]; total: number } | null>;
}
@injectable()
export class MeilisearchTvSeriesSearchReader implements ITvSeriesSearchReader {
  private retryAt = 0;
  constructor(@inject(SEARCH_CLIENT) private readonly client: ISearchClient,
    @inject(MEILISEARCH_CONFIG) private readonly config: MeilisearchConfig) {}
  async search(query: TvSeriesFilter & { fresh: boolean }) {
    if (!this.config.enabled || Date.now() < this.retryAt) return null;
    if (query.q && !/[\p{L}\p{N}]/u.test(query.q)) return { ids: [], total: 0 };
    const controller = new AbortController();
    try {
      return await withTimeout(this.page(query, controller.signal), 3000, "meilisearch.tv-series.search");
    } catch (error) {
      if (Date.now() >= this.retryAt) {
        this.retryAt = Date.now() + 30_000;
        const { event, level } = searchFailureEvent(error);
        reportRuntimeFailure(event, "Meilisearch TV series search failed. Using Postgres", error, level);
      }
      return null;
    } finally { controller.abort(); }
  }
  private async page(query: TvSeriesFilter & { fresh: boolean }, signal: AbortSignal) {
    const result = await this.client.search<{ id: number }>(TV_SERIES_SEARCH_INDEX, {
      q: query.q, filter: 'kind = "series"', page: query.page, hitsPerPage: query.limit, attributesToSearchOn: ["title"], attributesToRetrieve: ["id"],
      sort: query.fresh ? ["popularityScore:desc", "titleSort:asc", "id:asc"] : ["titleSort:asc", "id:asc"],
    }, { signal });
    const ids = result.hits.map((hit) => hit.id);
    const totalHits = result.totalHits;
    if (!Number.isSafeInteger(totalHits) || totalHits! < 0 || ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      throw new Error("Invalid TV series search page");
    }
    const total = await reachablePage(this.client, TV_SERIES_SEARCH_INDEX,
      { page: query.page, hitsPerPage: query.limit, totalHits: totalHits!, count: ids.length }, { signal });
    if (total === null) throw new Error("Invalid TV series search page");
    return { ids, total };
  }
}
