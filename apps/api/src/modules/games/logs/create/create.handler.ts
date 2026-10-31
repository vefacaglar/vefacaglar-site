import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { GAME_LOGS_REPOSITORY } from "../../games.tokens";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";
import { toGameLog, type GameLog, type GameLogBody } from "../game-log.schema";
import { toGameLogValues } from "../game-log.values";
import { CreateGameLogParams } from "./create.schema";

@injectable()
export class CreateGameLogHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: CreateGameLogParams; Body: GameLogBody }>): Promise<GameLog> {
    const game = await this.gamesRepo.findBySlug(request.params.slug);
    if (!game) throw new NotFoundError("Game not found.");

    const values = toGameLogValues(request.body, game);
    const created = await this.logsRepo.create({
      ...values,
      status: request.body.status,
      userId: request.user!.id,
      gameId: game.id,
    });
    return toGameLog(created);
  }
}
