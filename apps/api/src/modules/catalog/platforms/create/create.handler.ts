import { FastifyRequest } from "fastify";
import { CreatePlatformRequest, PlatformResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../../catalog.service";

@injectable()
export class CreatePlatformHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest<{ Body: CreatePlatformRequest }>): Promise<PlatformResponse> {
    const { name, slug } = request.body;

    const newPlatform = await this.catalogService.createPlatform({
      name,
      slug,
    });

    return {
      id: newPlatform.id,
      name: newPlatform.name,
      slug: newPlatform.slug,
      createdAt: newPlatform.createdAt.toISOString(),
      updatedAt: newPlatform.updatedAt ? newPlatform.updatedAt.toISOString() : null,
    };
  }
}
