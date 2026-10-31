import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { GAME_LOGS_REPOSITORY } from "../../games.tokens";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";
import { toGameLog, type GameLog, type GameLogBody } from "../game-log.schema";
import { toGameLogValues } from "../game-log.values";
import { GameLogIdParams } from "./update.schema";

@injectable()
export class UpdateGameLogHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: GameLogIdParams; Body: GameLogBody }>): Promise<GameLog> {
    const log = await this.logsRepo.findById(request.params.id);
    // Someone else's log answers like a missing one, so ids can't be probed.
    if (!log || log.userId !== request.user!.id) throw new NotFoundError("Log not found.");

    const game = await this.gamesRepo.findById(log.gameId);
    if (!game) throw new NotFoundError("Game not found.");

    const updated = await this.logsRepo.update(log.id, {
      ...toGameLogValues(request.body, game),
      updatedAt: new Date(),
    });
    return toGameLog(updated);
  }
}
