import { FastifyRequest } from "fastify";
import { DeleteDeveloperParams, DeleteDeveloperResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class DeleteDeveloperHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: DeleteDeveloperParams }>): Promise<DeleteDeveloperResponse> {
    const { id } = request.params;

    await this.catalogService.deleteDeveloper(id);

    return {
      success: true,
    };
  }
}
