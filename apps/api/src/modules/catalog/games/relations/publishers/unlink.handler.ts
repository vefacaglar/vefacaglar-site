import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkPublisherParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class UnlinkGamePublisherHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkPublisherParams }>
  ): Promise<RelationMutationResponse> {
    const { id, publisherId } = request.params;
    await this.catalogService.unlinkGamePublisher(id, publisherId);
    return { success: true };
  }
}
