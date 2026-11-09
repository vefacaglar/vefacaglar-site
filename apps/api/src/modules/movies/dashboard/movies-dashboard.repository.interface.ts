export type MovieDashboardStatsRow = { catalogCount: number; publicFilmCount: number; withPosterCount: number; posterBlockedCount: number };
export type MovieDashboardRow = { id: string; slug: string; title: string; releaseYear: number | null; posterImageUrl: string | null;
  isPublic: boolean; posterBlockedAt: Date | null };
export type MovieDashboardListFilter = { page: number; limit: number; q?: string; blockedOnly: boolean };
export interface IMovieDashboardRepository {
  stats(): Promise<MovieDashboardStatsRow>;
  list(filter: MovieDashboardListFilter): Promise<{ items: MovieDashboardRow[]; total: number }>;
  /** Returns null when no movie has this id. Blocking an already blocked poster keeps its original timestamp. */
  setPosterBlocked(id: string, blocked: boolean, now: Date): Promise<{ id: string; posterBlockedAt: Date | null } | null>;
}
export const MOVIE_DASHBOARD_REPOSITORY = Symbol("MovieDashboardRepository");
