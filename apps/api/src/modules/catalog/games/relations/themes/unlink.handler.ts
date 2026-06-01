import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkThemeParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class UnlinkGameThemeHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkThemeParams }>
  ): Promise<RelationMutationResponse> {
    const { id, themeId } = request.params;
    await this.catalogService.unlinkGameTheme(id, themeId);
    return { success: true };
  }
}
