import { FastifyRequest } from "fastify";
import { CreatePublisherRequest, PublisherResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class CreatePublisherHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Body: CreatePublisherRequest }>): Promise<PublisherResponse> {
    const { name, slug, countryCode } = request.body;

    const newPub = await this.catalogService.createPublisher({
      name,
      slug,
      countryCode,
    });

    return {
      id: newPub.id,
      name: newPub.name,
      slug: newPub.slug,
      countryCode: newPub.countryCode,
      createdAt: newPub.createdAt.toISOString(),
      updatedAt: newPub.updatedAt ? newPub.updatedAt.toISOString() : null,
    };
  }
}
