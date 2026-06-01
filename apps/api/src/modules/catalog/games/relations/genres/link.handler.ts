import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../../catalog.service";
import type { LinkGenreParams, RelationMutationResponse } from "../relation.schemas";

@injectable()
export class LinkGameGenreHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(
    request: FastifyRequest<{ Params: LinkGenreParams }>
  ): Promise<RelationMutationResponse> {
    const { id, genreId } = request.params;
    await this.catalogService.linkGameGenre(id, genreId);
    return { success: true };
  }
}
