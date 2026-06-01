import { FastifyRequest } from "fastify";
import { GetGenreParams, GenreResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class GetGenreHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: GetGenreParams }>): Promise<GenreResponse> {
    const { id } = request.params;

    const genre = await this.catalogService.getGenreById(id);

    return {
      id: genre.id,
      name: genre.name,
      slug: genre.slug,
      createdAt: genre.createdAt.toISOString(),
      updatedAt: genre.updatedAt ? genre.updatedAt.toISOString() : null,
    };
  }
}
