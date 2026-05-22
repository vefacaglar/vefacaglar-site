import { FastifyRequest } from "fastify";
import { DeleteGameParams, DeleteGameResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class DeleteGameHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: DeleteGameParams }>): Promise<DeleteGameResponse> {
    const { id } = request.params;

    await this.gameService.deleteGame(id);

    return {
      success: true,
    };
  }
}
