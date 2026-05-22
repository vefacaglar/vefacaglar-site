import { FastifyRequest } from "fastify";
import { CreatePlatformRequest, PlatformResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class CreatePlatformHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Body: CreatePlatformRequest }>): Promise<PlatformResponse> {
    const { name, slug } = request.body;

    const newPlatform = await this.gameService.createPlatform({
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
