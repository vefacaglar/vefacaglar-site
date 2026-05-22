import { FastifyRequest } from "fastify";
import { UpdateGameParams, UpdateGameRequest, GameResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class UpdateGameHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: UpdateGameParams; Body: UpdateGameRequest }>): Promise<GameResponse> {
    const { id } = request.params;
    const {
      title,
      slug,
      originalTitle,
      description,
      coverImageUrl,
      releaseDate,
      metacriticScore,
      openCriticScore,
      hltbMainHours,
      hltbMainExtraHours,
      hltbCompletionistHours,
      developerIds,
      publisherIds,
      genreIds,
      platformIds,
      themeIds,
    } = request.body;

    const updated = await this.gameService.updateGame(
      id,
      {
        title,
        slug,
        originalTitle,
        description,
        coverImageUrl,
        releaseDate,
        metacriticScore,
        openCriticScore,
        hltbMainHours,
        hltbMainExtraHours,
        hltbCompletionistHours,
      },
      {
        developerIds,
        publisherIds,
        genreIds,
        platformIds,
        themeIds,
      }
    );

    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      originalTitle: updated.originalTitle,
      description: updated.description,
      coverImageUrl: updated.coverImageUrl,
      releaseDate: updated.releaseDate,
      metacriticScore: updated.metacriticScore,
      openCriticScore: updated.openCriticScore,
      hltbMainHours: updated.hltbMainHours,
      hltbMainExtraHours: updated.hltbMainExtraHours,
      hltbCompletionistHours: updated.hltbCompletionistHours,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : null,
      
      developers: updated.developers.map(d => ({ id: d.id, name: d.name, slug: d.slug })),
      publishers: updated.publishers.map(p => ({ id: p.id, name: p.name, slug: p.slug })),
      genres: updated.genres.map(g => ({ id: g.id, name: g.name, slug: g.slug })),
      platforms: updated.platforms.map(pl => ({ id: pl.id, name: pl.name, slug: pl.slug })),
      themes: updated.themes.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    };
  }
}
