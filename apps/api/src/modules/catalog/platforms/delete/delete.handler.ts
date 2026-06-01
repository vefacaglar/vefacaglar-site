import { FastifyRequest } from "fastify";
import { DeletePlatformParams, DeletePlatformResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class DeletePlatformHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: DeletePlatformParams }>): Promise<DeletePlatformResponse> {
    const { id } = request.params;

    await this.catalogService.deletePlatform(id);

    return {
      success: true,
    };
  }
}
