import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameService } from "../../../games.service";
import type { LinkThemeParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGameThemeHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkThemeParams }>
  ): Promise<RelationMutationResponse> {
    const { id, themeId } = request.params;
    await this.gameService.linkGameTheme(id, themeId);
    return { success: true };
  }
}
