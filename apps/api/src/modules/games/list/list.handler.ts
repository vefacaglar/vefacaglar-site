import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../shared/search/queries/search-reader.interface";
import { GAMES_REPOSITORY } from "../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../catalog/games.repository.interface";
import { publicGameCard } from "../public-game-card";
import { ListGamesQuery, ListGamesResponse } from "./list.schema";

const DEFAULT_LIMIT = 24;

@injectable()
export class ListGamesHandler {
  constructor(
    @inject(SEARCH_READER) private readonly searchReader: ISearchReader,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository
  ) {}

  async handle(request: FastifyRequest<{ Querystring: ListGamesQuery }>): Promise<ListGamesResponse> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? DEFAULT_LIMIT;
    const q = request.query.q?.trim() || undefined;

    // Default browse reads authoritative indexed owner scores. Typed searches
    // retain their existing title relevance, without requiring a search schema rebuild.
    const result = q
      ? await this.searchReader.searchPublicGames({ page, limit, q })
      : await this.gamesRepo.listPublic({ page, limit });
    let items = result.items;
    if (q && items.length) {
      // Search owns relevance and counts; Postgres owns current display fields.
      // An overlapping index import must not restore old completion times on cards.
      const current = await this.gamesRepo.findPublicCardsByIds(items.map((game) => game.id));
      const byId = new Map(current.map((game) => [game.id, game]));
      items = items.flatMap((hit) => { const game = byId.get(hit.id); return game ? [game] : []; });
    }
    const total = result.total;
    return {
      items: items.map(publicGameCard),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
