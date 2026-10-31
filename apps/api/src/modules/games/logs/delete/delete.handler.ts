import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { NotFoundError } from "../../../../shared/http-errors";
import { GAME_LOGS_REPOSITORY } from "../../games.tokens";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";
import { DeleteGameLogResponse, GameLogIdParams } from "./delete.schema";

@injectable()
export class DeleteGameLogHandler {
  constructor(@inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository) {}

  async handle(request: FastifyRequest<{ Params: GameLogIdParams }>): Promise<DeleteGameLogResponse> {
    const log = await this.logsRepo.findById(request.params.id);
    if (!log || log.userId !== request.user!.id) throw new NotFoundError("Log not found.");

    await this.logsRepo.delete(log.id);
    return { success: true };
  }
}
