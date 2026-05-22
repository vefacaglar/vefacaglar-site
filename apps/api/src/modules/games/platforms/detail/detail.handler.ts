import { FastifyRequest } from "fastify";
import { GetPlatformParams, PlatformResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class GetPlatformHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: GetPlatformParams }>): Promise<PlatformResponse> {
    const { id } = request.params;

    const platform = await this.gameService.getPlatformById(id);

    return {
      id: platform.id,
      name: platform.name,
      slug: platform.slug,
      createdAt: platform.createdAt.toISOString(),
      updatedAt: platform.updatedAt ? platform.updatedAt.toISOString() : null,
    };
  }
}
