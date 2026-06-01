import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkDeveloperParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGameDeveloperHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkDeveloperParams }>
  ): Promise<RelationMutationResponse> {
    const { id, developerId } = request.params;
    await this.catalogService.linkGameDeveloper(id, developerId);
    return { success: true };
  }
}
