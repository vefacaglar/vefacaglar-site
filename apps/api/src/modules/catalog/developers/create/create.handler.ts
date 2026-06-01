import { FastifyRequest } from "fastify";
import { CreateDeveloperRequest, DeveloperResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class CreateDeveloperHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Body: CreateDeveloperRequest }>): Promise<DeveloperResponse> {
    const { name, slug, countryCode } = request.body;

    const newDev = await this.catalogService.createDeveloper({
      name,
      slug,
      countryCode,
    });

    return {
      id: newDev.id,
      name: newDev.name,
      slug: newDev.slug,
      countryCode: newDev.countryCode,
      createdAt: newDev.createdAt.toISOString(),
      updatedAt: newDev.updatedAt ? newDev.updatedAt.toISOString() : null,
    };
  }
}
