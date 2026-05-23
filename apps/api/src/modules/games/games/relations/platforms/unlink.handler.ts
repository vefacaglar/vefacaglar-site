import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameService } from "../../../games.service";
import type { LinkPlatformParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class UnlinkGamePlatformHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkPlatformParams }>
  ): Promise<RelationMutationResponse> {
    const { id, platformId } = request.params;
    await this.gameService.unlinkGamePlatform(id, platformId);
    return { success: true };
  }
}
