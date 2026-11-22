export const TV_SOURCE_REPOSITORY = Symbol("TvSourceRepository");
export type TvShowSource = {
  id: number; name: string; summary: string | null; premiered: string | null; ended: string | null;
  status: string | null; type: string | null; language: string | null; runtime: number | null; averageRuntime: number | null;
  network: string | null; webChannel: string | null; rating: number | null; sourceUrl: string; officialSite: string | null;
  sourceUpdatedAt: Date | null; genres: string[]; previousEpisodeId: number | null;
};
export type TvSeasonSource = {
  id: number; seriesId: number; number: number | null; name: string | null; summary: string | null;
  premiered: string | null; ended: string | null; episodeOrder: number | null; network: string | null; sourceUrl: string;
};
export type TvEpisodeSource = {
  id: number; seriesId: number; seasonId: number | null; seasonNumber: number | null; number: number | null;
  name: string | null; summary: string | null; type: string; isSpecial: boolean; airdate: string | null;
  airstamp: Date | null; runtime: number | null; rating: number | null; sourceUrl: string;
};
export type TvHierarchy = { show: TvShowSource; seasons: TvSeasonSource[]; episodes: TvEpisodeSource[] };
export type TvRefreshItem = { seriesId: number; requestedAt: Date };
export type TvSourceProgress = { nextPage: number; indexComplete: boolean; indexStartedAt: Date; catalogCompletedAt: Date | null;
  updatesCheckedAt: Date | null; cooldownUntil: Date | null };
export interface ITvSourceRepository {
  state(now: Date): Promise<TvSourceProgress>;
  indexPage(page: number, shows: TvShowSource[], at: Date): Promise<void>;
  completeIndex(at: Date): Promise<void>;
  updates(rows: { id: number; updatedAt: Date }[], at: Date): Promise<void>;
  candidates(limit: number, now: Date): Promise<TvRefreshItem[]>;
  hierarchy(item: TvRefreshItem, snapshot: TvHierarchy, at: Date): Promise<void>;
  missing(item: TvRefreshItem, at: Date): Promise<void>;
  failure(item: TvRefreshItem, code: string, retryAt: Date): Promise<void>;
  cooldown(until: Date): Promise<void>;
  hasMore(now: Date): Promise<boolean>;
}
