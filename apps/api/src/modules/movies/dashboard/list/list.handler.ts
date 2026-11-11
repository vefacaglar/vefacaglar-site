import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { MOVIE_DASHBOARD_REPOSITORY, type IMovieDashboardRepository } from "../movies-dashboard.repository.interface";
import type { ListDashboardMoviesQuery, ListDashboardMoviesResponse } from "./list.schema";
const DEFAULT_LIMIT = 24;
@injectable()
export class ListDashboardMoviesHandler {
  constructor(@inject(MOVIE_DASHBOARD_REPOSITORY) private readonly repo: IMovieDashboardRepository) {}
  async handle(request: FastifyRequest<{ Querystring: ListDashboardMoviesQuery }>): Promise<ListDashboardMoviesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    const q = request.query.q?.trim() || undefined;
    const { items, total } = await this.repo.list({ page, limit, q, blockedOnly: request.query.blocked === true });
    return { items: items.map(({ posterBlockedAt, ...movie }) => ({ ...movie, posterImageUrl: null, posterBlocked: posterBlockedAt !== null,
      posterBlockedAt: posterBlockedAt?.toISOString() ?? null })), total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
