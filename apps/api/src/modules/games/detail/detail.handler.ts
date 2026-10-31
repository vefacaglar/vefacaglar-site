import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../catalog/games.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { publicCriticScore } from "../critic-score";
import { GameDetailResponse, GetGameParams } from "./detail.schema";

const toNumber = (value: string | null): number | null => (value === null ? null : Number(value));
const named = (items: { name: string; slug: string }[]) => items.map((i) => ({ name: i.name, slug: i.slug }));

@injectable()
export class GetGameHandler {
  constructor(@inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetGameParams }>): Promise<GameDetailResponse> {
    const game = await this.gamesRepo.findBySlug(request.params.slug);
    if (!game) throw new NotFoundError("Game not found.");
    const criticScore = publicCriticScore(game.criticScore, game.criticScoreCount);

    return {
      slug: game.slug,
      title: game.title,
      description: game.description,
      coverImageUrl: game.coverImageUrl,
      releaseDate: game.releaseDate,
      criticScore,
      criticScoreCount: criticScore === null ? null : game.criticScoreCount,
      hltbMainHours: toNumber(game.hltbMainHours),
      hltbMainExtraHours: toNumber(game.hltbMainExtraHours),
      hltbCompletionistHours: toNumber(game.hltbCompletionistHours),
      developers: named(game.developers),
      publishers: named(game.publishers),
      genres: named(game.genres),
      themes: named(game.themes),
      platforms: game.platforms.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
    };
  }
}
