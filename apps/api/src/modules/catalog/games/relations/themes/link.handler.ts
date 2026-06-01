import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkThemeParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGameThemeHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkThemeParams }>
  ): Promise<RelationMutationResponse> {
    const { id, themeId } = request.params;
    await this.catalogService.linkGameTheme(id, themeId);
    return { success: true };
  }
}
