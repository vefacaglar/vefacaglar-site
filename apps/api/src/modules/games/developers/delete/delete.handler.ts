import { FastifyRequest } from "fastify";
import { DeleteDeveloperParams, DeleteDeveloperResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class DeleteDeveloperHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: DeleteDeveloperParams }>): Promise<DeleteDeveloperResponse> {
    const { id } = request.params;

    await this.gameService.deleteDeveloper(id);

    return {
      success: true,
    };
  }
}
