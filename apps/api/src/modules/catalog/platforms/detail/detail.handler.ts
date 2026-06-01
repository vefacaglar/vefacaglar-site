import { FastifyRequest } from "fastify";
import { GetPlatformParams, PlatformResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class GetPlatformHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Params: GetPlatformParams }>): Promise<PlatformResponse> {
    const { id } = request.params;

    const platform = await this.catalogService.getPlatformById(id);

    return {
      id: platform.id,
      name: platform.name,
      slug: platform.slug,
      createdAt: platform.createdAt.toISOString(),
      updatedAt: platform.updatedAt ? platform.updatedAt.toISOString() : null,
    };
  }
}
