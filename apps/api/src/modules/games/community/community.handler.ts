import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { GAME_COMMUNITY_REPOSITORY } from "./community.tokens";
import type { IGameCommunityRepository } from "./community.repository.interface";
import type { GameCommunity, GameCommunityParams, GameCommunityQuery } from "./community.schema";

@injectable()
export class GetGameCommunityHandler {
  constructor(@inject(GAME_COMMUNITY_REPOSITORY) private readonly repo: IGameCommunityRepository) {}
  async handle(request: FastifyRequest<{ Params: GameCommunityParams; Querystring: GameCommunityQuery }>): Promise<GameCommunity> {
    const id = await this.repo.findPublicGameId(request.params.slug);
    if (!id) throw new NotFoundError("Game not found.");
    const page = request.query.page ?? 1, limit = request.query.limit ?? 10;
    const result = await this.repo.getCommunity(id, page, limit);
    return {
      rating: { average: result.rating.average, count: result.rating.count, scale: 100 },
      entries: result.entries.map((entry) => ({
        id: entry.id,
        author: { username: entry.author.username, displayName: entry.author.displayName },
        sharedAt: entry.sharedAt.toISOString(),
        text: entry.text,
        rating: entry.rating,
        status: entry.status, startedAt: entry.startedAt, completedAt: entry.completedAt,
      })),
      total: result.total, page, limit, totalPages: Math.ceil(result.total / limit),
    };
  }
}
