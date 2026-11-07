import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";

import { MOVIE_CATALOG_SERVICE, type IMovieCatalogService } from "../search/movie-catalog.service";
import type { ListMoviesQuery, ListMoviesResponse } from "./list.schema";
@injectable()
export class ListMoviesHandler {
  constructor(@inject(MOVIE_CATALOG_SERVICE) private readonly repo: IMovieCatalogService) {}
  async handle(request: FastifyRequest<{ Querystring: ListMoviesQuery }>): Promise<ListMoviesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? 21;
    const q = request.query.q?.trim() || undefined;
    const { items, total, ranking } = await this.repo.listPublic({ page, limit, q });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit), ranking };
  }
}
