import { FastifyRequest } from "fastify";
import { DeleteGenreParams, DeleteGenreResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class DeleteGenreHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: DeleteGenreParams }>): Promise<DeleteGenreResponse> {
    const { id } = request.params;

    await this.gameService.deleteGenre(id);

    return {
      success: true,
    };
  }
}
