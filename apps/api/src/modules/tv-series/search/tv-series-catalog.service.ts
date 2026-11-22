import { inject, injectable } from "tsyringe";
import { TV_SERIES_REPOSITORY, type ITvSeriesRepository, type TvSeriesFilter, type TvSeriesListResult } from "../tv-series.repository.interface";
import { TV_SERIES_SEARCH_READER, type ITvSeriesSearchReader } from "./tv-series-search.reader";
export const TV_SERIES_CATALOG_SERVICE = Symbol("TvSeriesCatalogService");
export interface ITvSeriesCatalogService { listPublic(filter: TvSeriesFilter): Promise<TvSeriesListResult> }
@injectable()
export class TvSeriesCatalogService implements ITvSeriesCatalogService {
  constructor(@inject(TV_SERIES_REPOSITORY) private readonly repo: ITvSeriesRepository,
    @inject(TV_SERIES_SEARCH_READER) private readonly reader: ITvSeriesSearchReader) {}
  async listPublic(filter: TvSeriesFilter): Promise<TvSeriesListResult> {
    if (!filter.q) return this.repo.listPublic(filter);
    try {
      const before = await this.repo.searchPublication();
      if (before.ready) {
        const result = await this.reader.search({ ...filter, fresh: before.ranking.isFresh });
        if (result) {
          const items = await this.repo.hydrateCards(result.ids);
          const after = await this.repo.searchPublication();
          if (after.ready && before.generation === after.generation &&
              JSON.stringify(before.ranking) === JSON.stringify(after.ranking) && items.length === result.ids.length) {
            return { items, total: result.total, ranking: after.ranking };
          }
        }
      }
    } catch {
      // An unavailable or changing read model falls back to the canonical catalog.
    }
    return this.repo.listPublic(filter);
  }
}
