import { FastifyRequest } from "fastify";
import { DeletePublisherParams, DeletePublisherResponse } from "./delete.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class DeletePublisherHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: DeletePublisherParams }>): Promise<DeletePublisherResponse> {
    const { id } = request.params;

    await this.gameService.deletePublisher(id);

    return {
      success: true,
    };
  }
}
