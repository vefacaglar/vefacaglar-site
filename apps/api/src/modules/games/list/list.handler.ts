import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../catalog/games.repository.interface";
import { ListGamesQuery, ListGamesResponse } from "./list.schema";

const DEFAULT_LIMIT = 24;

@injectable()
export class ListGamesHandler {
  constructor(@inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListGamesQuery }>): Promise<ListGamesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    const q = request.query.q?.trim() || undefined;

    const { items, total } = await this.gamesRepo.listPublic({ page, limit, q });
    return {
      items: items.map((g) => ({
        slug: g.slug,
        title: g.title,
        coverImageUrl: g.coverImageUrl,
        releaseDate: g.releaseDate,
        criticScore: g.criticScore,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
