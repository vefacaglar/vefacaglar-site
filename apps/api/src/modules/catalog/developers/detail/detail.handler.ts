import { FastifyRequest } from "fastify";
import { GetDeveloperParams, DeveloperResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class GetDeveloperHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: GetDeveloperParams }>): Promise<DeveloperResponse> {
    const { id } = request.params;

    const dev = await this.catalogService.getDeveloperById(id);

    return {
      id: dev.id,
      name: dev.name,
      slug: dev.slug,
      countryCode: dev.countryCode,
      createdAt: dev.createdAt.toISOString(),
      updatedAt: dev.updatedAt ? dev.updatedAt.toISOString() : null,
    };
  }
}
