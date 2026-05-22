import { FastifyRequest } from "fastify";
import { DeletePlatformParams, DeletePlatformResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class DeletePlatformHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: DeletePlatformParams }>): Promise<DeletePlatformResponse> {
    const { id } = request.params;

    await this.gameService.deletePlatform(id);

    return {
      success: true,
    };
  }
}
