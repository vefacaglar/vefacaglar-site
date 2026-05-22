import { FastifyRequest } from "fastify";
import { GetGenreParams, GenreResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class GetGenreHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: GetGenreParams }>): Promise<GenreResponse> {
    const { id } = request.params;

    const genre = await this.gameService.getGenreById(id);

    return {
      id: genre.id,
      name: genre.name,
      slug: genre.slug,
      createdAt: genre.createdAt.toISOString(),
      updatedAt: genre.updatedAt ? genre.updatedAt.toISOString() : null,
    };
  }
}
