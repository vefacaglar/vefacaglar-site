import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { TV_SERIES_CATALOG_SERVICE, type ITvSeriesCatalogService } from "../search/tv-series-catalog.service";
import type { ListTvSeriesQuery, ListTvSeriesResponse } from "./list.schema";
@injectable()
export class ListTvSeriesHandler {
  constructor(@inject(TV_SERIES_CATALOG_SERVICE) private readonly catalog: ITvSeriesCatalogService) {}
  async handle(request: FastifyRequest<{ Querystring: ListTvSeriesQuery }>): Promise<ListTvSeriesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? 21;
    const data = await this.catalog.listPublic({ page, limit, q: request.query.q?.trim() || undefined });
    return { ...data, page, limit, totalPages: Math.ceil(data.total / limit) };
  }
}
