import { FastifyRequest } from "fastify";
import { UpdateGenreParams, UpdateGenreRequest, GenreResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class UpdateGenreHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: UpdateGenreParams; Body: UpdateGenreRequest }>): Promise<GenreResponse> {
    const { id } = request.params;
    const { name, slug } = request.body;

    const updatedGenre = await this.gameService.updateGenre(id, {
      name,
      slug,
    });

    return {
      id: updatedGenre.id,
      name: updatedGenre.name,
      slug: updatedGenre.slug,
      createdAt: updatedGenre.createdAt.toISOString(),
      updatedAt: updatedGenre.updatedAt ? updatedGenre.updatedAt.toISOString() : null,
    };
  }
}
