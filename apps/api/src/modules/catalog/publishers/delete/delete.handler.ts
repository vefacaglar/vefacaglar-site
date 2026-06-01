import { FastifyRequest } from "fastify";
import { DeletePublisherParams, DeletePublisherResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class DeletePublisherHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: DeletePublisherParams }>): Promise<DeletePublisherResponse> {
    const { id } = request.params;

    await this.catalogService.deletePublisher(id);

    return {
      success: true,
    };
  }
}
