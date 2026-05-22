import { FastifyRequest } from "fastify";
import { CreateGameRequest, GameResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class CreateGameHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Body: CreateGameRequest }>): Promise<GameResponse> {
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

    const newGame = await this.gameService.createGame(
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
      id: newGame.id,
      slug: newGame.slug,
      title: newGame.title,
      originalTitle: newGame.originalTitle,
      description: newGame.description,
      coverImageUrl: newGame.coverImageUrl,
      releaseDate: newGame.releaseDate,
      metacriticScore: newGame.metacriticScore,
      openCriticScore: newGame.openCriticScore,
      hltbMainHours: newGame.hltbMainHours,
      hltbMainExtraHours: newGame.hltbMainExtraHours,
      hltbCompletionistHours: newGame.hltbCompletionistHours,
      createdAt: newGame.createdAt.toISOString(),
      updatedAt: newGame.updatedAt ? newGame.updatedAt.toISOString() : null,
      
      developers: newGame.developers.map(d => ({ id: d.id, name: d.name, slug: d.slug })),
      publishers: newGame.publishers.map(p => ({ id: p.id, name: p.name, slug: p.slug })),
      genres: newGame.genres.map(g => ({ id: g.id, name: g.name, slug: g.slug })),
      platforms: newGame.platforms.map(pl => ({ id: pl.id, name: pl.name, slug: pl.slug })),
      themes: newGame.themes.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    };
  }
}
