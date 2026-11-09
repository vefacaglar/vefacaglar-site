import { injectable } from "tsyringe";
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { movies } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { movieTitleMatch } from "../movie-title-search";
import type { IMovieDashboardRepository, MovieDashboardListFilter } from "./movies-dashboard.repository.interface";

// Mirrors the public visibility rule (is_film, hydrated, titled); rows listed here always have a title.
const isPublic = sql<boolean>`(${movies.isFilm} = true and ${movies.hydratedAt} is not null)`;

@injectable()
export class DrizzleMovieDashboardRepository implements IMovieDashboardRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async stats() {
    const publicFilm = sql`${movies.isFilm} = true and ${movies.hydratedAt} is not null and ${movies.title} is not null`;
    const [row] = await this.dbProvider.client.select({
      catalogCount: count(),
      publicFilmCount: sql<number>`count(*) filter (where ${publicFilm})`.mapWith(Number),
      withPosterCount: sql<number>`count(*) filter (where ${publicFilm} and ${movies.posterImageUrl} is not null and ${movies.posterBlockedAt} is null)`.mapWith(Number),
      posterBlockedCount: sql<number>`count(*) filter (where ${movies.posterBlockedAt} is not null)`.mapWith(Number),
    }).from(movies);
    return { catalogCount: Number(row?.catalogCount ?? 0), publicFilmCount: row?.publicFilmCount ?? 0,
      withPosterCount: row?.withPosterCount ?? 0, posterBlockedCount: row?.posterBlockedCount ?? 0 };
  }
  async list(filter: MovieDashboardListFilter) {
    // Untitled rows are unhydrated discovery stubs: nothing to recognize or block yet.
    const where = and(isNotNull(movies.title), filter.blockedOnly ? isNotNull(movies.posterBlockedAt) : undefined, movieTitleMatch(filter.q));
    const [rows, totals] = await Promise.all([
      this.dbProvider.client.select({ id: movies.id, slug: movies.slug, title: sql<string>`${movies.title}`, releaseYear: movies.releaseYear,
        posterImageUrl: movies.posterImageUrl, isPublic, posterBlockedAt: movies.posterBlockedAt }).from(movies).where(where)
        .orderBy(asc(movies.title), asc(movies.id)).limit(filter.limit).offset((filter.page - 1) * filter.limit),
      this.dbProvider.client.select({ total: count() }).from(movies).where(where),
    ]);
    return { items: rows, total: Number(totals[0]?.total ?? 0) };
  }
  async setPosterBlocked(id: string, blocked: boolean, now: Date) {
    // Ingestion and artwork jobs never write this column, so the block survives every sync.
    const [row] = await this.dbProvider.client.update(movies)
      .set({ posterBlockedAt: blocked ? sql`coalesce(${movies.posterBlockedAt}, ${now.toISOString()}::timestamptz)` : null, updatedAt: now })
      .where(eq(movies.id, id)).returning({ id: movies.id, posterBlockedAt: movies.posterBlockedAt });
    return row ?? null;
  }
}
