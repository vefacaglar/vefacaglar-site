import { FastifyRequest } from "fastify";
import { UpdatePublisherParams, UpdatePublisherRequest, PublisherResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class UpdatePublisherHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: UpdatePublisherParams; Body: UpdatePublisherRequest }>): Promise<PublisherResponse> {
    const { id } = request.params;
    const { name, slug, countryCode } = request.body;

    const updatedPub = await this.catalogService.updatePublisher(id, {
      name,
      slug,
      countryCode,
    });

    return {
      id: updatedPub.id,
      name: updatedPub.name,
      slug: updatedPub.slug,
      countryCode: updatedPub.countryCode,
      createdAt: updatedPub.createdAt.toISOString(),
      updatedAt: updatedPub.updatedAt ? updatedPub.updatedAt.toISOString() : null,
    };
  }
}
