export interface DashboardMovie {
  id: string;
  slug: string;
  title: string;
  releaseYear: number | null;
  posterImageUrl: string | null;
  isPublic: boolean;
  posterBlocked: boolean;
  posterBlockedAt: string | null;
}

export interface MovieListResult {
  items: DashboardMovie[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MovieStats {
  movieCount: number;
  catalogCount: number;
  withPosterCount: number;
  posterBlockedCount: number;
}
