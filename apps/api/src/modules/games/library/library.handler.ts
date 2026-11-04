import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAME_LOGS_REPOSITORY } from "../games.tokens";
import type { IGameLogsRepository } from "../game-logs.repository.interface";
import { buildLibrary } from "../library-stats";
import { LibraryResponse } from "./library.schema";

/** The signed-in user's games with per-game rating/playtime and overall stats, for the profile page. */
@injectable()
export class GetLibraryHandler {
  constructor(@inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository) {}

  async handle(request: FastifyRequest): Promise<LibraryResponse> {
    const logs = await this.logsRepo.listForUser(request.user!.id);
    return buildLibrary(logs);
  }
}
