import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameService } from "../../../games.service";
import type { LinkDeveloperParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGameDeveloperHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkDeveloperParams }>
  ): Promise<RelationMutationResponse> {
    const { id, developerId } = request.params;
    await this.gameService.linkGameDeveloper(id, developerId);
    return { success: true };
  }
}
