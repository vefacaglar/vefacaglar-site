import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkGenreParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class UnlinkGameGenreHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkGenreParams }>
  ): Promise<RelationMutationResponse> {
    const { id, genreId } = request.params;
    await this.catalogService.unlinkGameGenre(id, genreId);
    return { success: true };
  }
}
