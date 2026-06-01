import { FastifyRequest } from "fastify";
import { GetGameParams, GameResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class GetGameHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: GetGameParams }>): Promise<GameResponse> {
    const { id } = request.params;

    const game = await this.catalogService.getGameById(id);

    return {
      id: game.id,
      slug: game.slug,
      title: game.title,
      originalTitle: game.originalTitle,
      description: game.description,
      coverImageUrl: game.coverImageUrl,
      releaseDate: game.releaseDate,
      metacriticScore: game.metacriticScore,
      openCriticScore: game.openCriticScore,
      hltbMainHours: game.hltbMainHours,
      hltbMainExtraHours: game.hltbMainExtraHours,
      hltbCompletionistHours: game.hltbCompletionistHours,
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt ? game.updatedAt.toISOString() : null,
      
      developers: game.developers.map(d => ({ id: d.id, name: d.name, slug: d.slug })),
      publishers: game.publishers.map(p => ({ id: p.id, name: p.name, slug: p.slug })),
      genres: game.genres.map(g => ({ id: g.id, name: g.name, slug: g.slug })),
      platforms: game.platforms.map(pl => ({ id: pl.id, name: pl.name, slug: pl.slug })),
      themes: game.themes.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    };
  }
}
