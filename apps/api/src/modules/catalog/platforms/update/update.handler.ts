import { FastifyRequest } from "fastify";
import { UpdatePlatformParams, UpdatePlatformRequest, PlatformResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class UpdatePlatformHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: UpdatePlatformParams; Body: UpdatePlatformRequest }>): Promise<PlatformResponse> {
    const { id } = request.params;
    const { name, slug } = request.body;

    const updatedPlatform = await this.catalogService.updatePlatform(id, {
      name,
      slug,
    });

    return {
      id: updatedPlatform.id,
      name: updatedPlatform.name,
      slug: updatedPlatform.slug,
      createdAt: updatedPlatform.createdAt.toISOString(),
      updatedAt: updatedPlatform.updatedAt ? updatedPlatform.updatedAt.toISOString() : null,
    };
  }
}
