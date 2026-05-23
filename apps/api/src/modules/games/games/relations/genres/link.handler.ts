import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameService } from "../../../games.service";
import type { LinkGenreParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGameGenreHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkGenreParams }>
  ): Promise<RelationMutationResponse> {
    const { id, genreId } = request.params;
    await this.gameService.linkGameGenre(id, genreId);
    return { success: true };
  }
}
