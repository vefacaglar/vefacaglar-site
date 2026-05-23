import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameService } from "../../../games.service";
import type { LinkPublisherParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGamePublisherHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkPublisherParams }>
  ): Promise<RelationMutationResponse> {
    const { id, publisherId } = request.params;
    await this.gameService.linkGamePublisher(id, publisherId);
    return { success: true };
  }
}
