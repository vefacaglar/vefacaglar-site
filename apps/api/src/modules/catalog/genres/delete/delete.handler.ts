import { FastifyRequest } from "fastify";
import { DeleteGenreParams, DeleteGenreResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class DeleteGenreHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: DeleteGenreParams }>): Promise<DeleteGenreResponse> {
    const { id } = request.params;

    await this.catalogService.deleteGenre(id);

    return {
      success: true,
    };
  }
}
