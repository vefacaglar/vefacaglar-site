import { FastifyRequest } from "fastify";
import { CreateGenreRequest, GenreResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class CreateGenreHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Body: CreateGenreRequest }>): Promise<GenreResponse> {
    const { name, slug } = request.body;

    const newGenre = await this.catalogService.createGenre({
      name,
      slug,
    });

    return {
      id: newGenre.id,
      name: newGenre.name,
      slug: newGenre.slug,
      createdAt: newGenre.createdAt.toISOString(),
      updatedAt: newGenre.updatedAt ? newGenre.updatedAt.toISOString() : null,
    };
  }
}
