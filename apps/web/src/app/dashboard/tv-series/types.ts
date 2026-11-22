export type TvDashboardStats = { total: number; complete: number; pending: number; seasons: number; episodes: number; specials: number };
export type TvDashboardItem = { id: number; title: string; sourceUrl: string; hierarchyComplete: boolean; seasonCount: number | null; episodeCount: number | null; specialCount: number | null; hierarchyUpdatedAt: string | null; fetchedAt: string };
export type TvDashboardList = { items: TvDashboardItem[]; total: number; page: number; limit: number; totalPages: number };
