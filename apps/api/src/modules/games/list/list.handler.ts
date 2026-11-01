import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../shared/search/queries/search-reader.interface";
import { publicCriticScore } from "../critic-score";
import { ListGamesQuery, ListGamesResponse } from "./list.schema";

const DEFAULT_LIMIT = 24;

@injectable()
export class ListGamesHandler {
  constructor(@inject(SEARCH_READER) private readonly searchReader: ISearchReader) {}

  async handle(request: FastifyRequest<{ Querystring: ListGamesQuery }>): Promise<ListGamesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    const q = request.query.q?.trim() || undefined;

    const { items, total } = await this.searchReader.searchPublicGames({ page, limit, q });
    return {
      items: items.map((g) => ({
        slug: g.slug,
        title: g.title,
        coverImageUrl: g.coverImageUrl,
        releaseDate: g.releaseDate,
        criticScore: publicCriticScore(g.criticScore, g.criticScoreCount),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
