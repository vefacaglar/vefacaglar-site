import type { TvRanking, TvSeriesCard } from "./list/list.schema";
import type { TvSeriesDetail } from "./detail/detail.schema";
import type { TvSeasonDetail } from "./season/season.schema";
export const TV_SERIES_REPOSITORY = Symbol("TvSeriesRepository");
export interface TvSeriesFilter { page: number; limit: number; q?: string }
export interface TvSeriesListResult { items: TvSeriesCard[]; total: number; ranking: TvRanking }
export interface TvSearchPublication {
  generation: number; ready: boolean; ranking: TvRanking;
}
export interface ITvSeriesRepository {
  searchPublication(): Promise<TvSearchPublication>;
  hydrateCards(ids: number[]): Promise<TvSeriesCard[]>;
  listPublic(filter: TvSeriesFilter): Promise<TvSeriesListResult>;
  findPublic(id: number): Promise<TvSeriesDetail | null>;
  findSeason(seriesId: number, seasonId: number): Promise<TvSeasonDetail | null>;
}
