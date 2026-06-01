import { FastifyRequest } from "fastify";
import { UpdateDeveloperParams, UpdateDeveloperRequest, DeveloperResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class UpdateDeveloperHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: UpdateDeveloperParams; Body: UpdateDeveloperRequest }>): Promise<DeveloperResponse> {
    const { id } = request.params;
    const { name, slug, countryCode } = request.body;

    const updatedDev = await this.catalogService.updateDeveloper(id, {
      name,
      slug,
      countryCode,
    });

    return {
      id: updatedDev.id,
      name: updatedDev.name,
      slug: updatedDev.slug,
      countryCode: updatedDev.countryCode,
      createdAt: updatedDev.createdAt.toISOString(),
      updatedAt: updatedDev.updatedAt ? updatedDev.updatedAt.toISOString() : null,
    };
  }
}
