import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameService } from "../../../games.service";
import type { LinkDeveloperParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class UnlinkGameDeveloperHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkDeveloperParams }>
  ): Promise<RelationMutationResponse> {
    const { id, developerId } = request.params;
    await this.gameService.unlinkGameDeveloper(id, developerId);
    return { success: true };
  }
}
