import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { GAME_LOGS_REPOSITORY } from "../../games.tokens";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";
import { toGameLog } from "../game-log.schema";
import { ListGameLogsParams, ListGameLogsResponse } from "./list.schema";

/** The signed-in user's own logs for a game. */
@injectable()
export class ListGameLogsHandler {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: ListGameLogsParams }>): Promise<ListGameLogsResponse> {
    const game = await this.gamesRepo.findBySlug(request.params.slug);
    if (!game) throw new NotFoundError("Game not found.");

    const rows = await this.logsRepo.listForUserGame(request.user!.id, game.id);
    return { items: rows.map(toGameLog) };
  }
}
