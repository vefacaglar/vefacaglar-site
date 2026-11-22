export type TvDashboardStats = { total: number; complete: number; pending: number; seasons: number; episodes: number; specials: number };
export type TvDashboardFilter = { page: number; limit: number; q?: string; hydration: "all" | "pending" | "complete" };
export type TvDashboardRow = { id: number; title: string; sourceUrl: string; hierarchyComplete: boolean; seasonCount: number; episodeCount: number; specialCount: number; hierarchyUpdatedAt: Date | null; fetchedAt: Date };
export interface ITvDashboardRepository {
  stats(): Promise<TvDashboardStats>;
  list(filter: TvDashboardFilter): Promise<{ items: TvDashboardRow[]; total: number }>;
}
export const TV_DASHBOARD_REPOSITORY = Symbol("TvDashboardRepository");
