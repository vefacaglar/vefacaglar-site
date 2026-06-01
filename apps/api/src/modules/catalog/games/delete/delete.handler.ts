import { FastifyRequest } from "fastify";
import { DeleteGameParams, DeleteGameResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class DeleteGameHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: DeleteGameParams }>): Promise<DeleteGameResponse> {
    const { id } = request.params;

    await this.catalogService.deleteGame(id);

    return {
      success: true,
    };
  }
}
