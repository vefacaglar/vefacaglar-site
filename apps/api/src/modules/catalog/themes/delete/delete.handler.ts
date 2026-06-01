import { FastifyRequest } from "fastify";
import { DeleteThemeParams, DeleteThemeResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class DeleteThemeHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: DeleteThemeParams }>): Promise<DeleteThemeResponse> {
    const { id } = request.params;

    await this.catalogService.deleteTheme(id);

    return {
      success: true,
    };
  }
}
