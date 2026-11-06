import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import type { IMoviesRepository } from "../movies.repository.interface";
import type { ListMoviesQuery, ListMoviesResponse } from "./list.schema";
@injectable()
export class ListMoviesHandler {
  constructor(@inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository) {}
  async handle(request: FastifyRequest<{ Querystring: ListMoviesQuery }>): Promise<ListMoviesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? 21;
    const q = request.query.q?.trim() || undefined;
    const { items, total, ranking } = await this.repo.listPublic({ page, limit, q });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit), ranking };
  }
}
