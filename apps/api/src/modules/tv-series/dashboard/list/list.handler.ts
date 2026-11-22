import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { TV_DASHBOARD_REPOSITORY, type ITvDashboardRepository } from "../tv-dashboard.repository.interface";
import type { ListDashboardTvQuery, ListDashboardTvResponse } from "./list.schema";
@injectable()
export class ListDashboardTvHandler {
  constructor(@inject(TV_DASHBOARD_REPOSITORY) private readonly repo: ITvDashboardRepository) {}
  async handle(request: FastifyRequest<{ Querystring: ListDashboardTvQuery }>): Promise<ListDashboardTvResponse> {
    const { page = 1, limit = 50, hydration = "all" } = request.query;
    const q = request.query.q?.trim() || undefined;
    const { items, total } = await this.repo.list({ page, limit, q, hydration });
    return { items: items.map((item) => ({ ...item,
      seasonCount: item.hierarchyComplete ? item.seasonCount : null,
      episodeCount: item.hierarchyComplete ? item.episodeCount : null,
      specialCount: item.hierarchyComplete ? item.specialCount : null,
      hierarchyUpdatedAt: item.hierarchyUpdatedAt?.toISOString() ?? null, fetchedAt: item.fetchedAt.toISOString(),
    })), total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
