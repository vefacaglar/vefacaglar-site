import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkPlatformParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGamePlatformHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkPlatformParams }>
  ): Promise<RelationMutationResponse> {
    const { id, platformId } = request.params;
    await this.catalogService.linkGamePlatform(id, platformId);
    return { success: true };
  }
}
