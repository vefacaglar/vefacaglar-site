import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAME_LOGS_REPOSITORY } from "../games.tokens";
import type { GameLogWithGame, IGameLogsRepository } from "../game-logs.repository.interface";
import { LibraryGame, LibraryResponse } from "./library.schema";

const round1 = (value: number) => Math.round(value * 10) / 10;

/** The signed-in user's games with per-game rating/playtime and overall stats, for the profile page. */
@injectable()
export class GetLibraryHandler {
  constructor(@inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository) {}

  async handle(request: FastifyRequest): Promise<LibraryResponse> {
    // Newest first, so the first log seen for a game is its latest.
    const logs = await this.logsRepo.listForUser(request.user!.id);

    const byGame = new Map<string, GameLogWithGame[]>();
    for (const log of logs) {
      const list = byGame.get(log.gameId);
      if (list) list.push(log);
      else byGame.set(log.gameId, [log]);
    }

    const games: LibraryGame[] = [...byGame.values()].map((gameLogs) => {
      const latest = gameLogs[0];
      const rated = gameLogs.find((l) => l.rating !== null);
      const hours = gameLogs.filter((l) => l.playtimeHours !== null).map((l) => Number(l.playtimeHours));
      return {
        slug: latest.game.slug,
        title: latest.game.title,
        coverImageUrl: latest.game.coverImageUrl,
        status: latest.status,
        rating: rated ? Number(rated.rating) : null,
        playtimeHours: hours.length > 0 ? round1(hours.reduce((a, b) => a + b, 0)) : null,
        logCount: gameLogs.length,
        lastLoggedAt: latest.createdAt.toISOString(),
      };
    });

    const ratings = games.map((g) => g.rating).filter((r): r is number => r !== null);
    return {
      summary: {
        gameCount: games.length,
        logCount: logs.length,
        completedCount: [...byGame.values()].filter((gameLogs) => gameLogs.some((l) => l.status === "completed")).length,
        playtimeHours: round1(games.reduce((sum, g) => sum + (g.playtimeHours ?? 0), 0)),
        averageRating: ratings.length > 0 ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
      },
      games,
    };
  }
}
