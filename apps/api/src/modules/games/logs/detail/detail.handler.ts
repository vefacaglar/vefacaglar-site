import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { GAME_LOGS_REPOSITORY } from "../../games.tokens";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";
import { toGameLog } from "../game-log.schema";
import { GameLogDetailResponse, GameLogIdParams } from "./detail.schema";

@injectable()
export class GetGameLogHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: GameLogIdParams }>): Promise<GameLogDetailResponse> {
    const log = await this.logsRepo.findById(request.params.id);
    if (!log || log.userId !== request.user!.id) throw new NotFoundError("Log not found.");

    const game = await this.gamesRepo.findById(log.gameId);
    if (!game) throw new NotFoundError("Game not found.");

    return {
      log: toGameLog(log),
      game: {
        slug: game.slug,
        title: game.title,
        coverImageUrl: game.coverImageUrl,
        platforms: game.platforms.map((p) => ({ id: p.id, name: p.name })),
      },
    };
  }
}
