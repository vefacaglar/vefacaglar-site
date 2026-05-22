import { FastifyRequest } from "fastify";
import { DeleteThemeParams, DeleteThemeResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class DeleteThemeHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: DeleteThemeParams }>): Promise<DeleteThemeResponse> {
    const { id } = request.params;

    await this.gameService.deleteTheme(id);

    return {
      success: true,
    };
  }
}
