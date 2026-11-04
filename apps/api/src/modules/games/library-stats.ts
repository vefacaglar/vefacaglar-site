import type { GameLogWithGame } from "./game-logs.repository.interface";
import type { LibraryGame, LibraryResponse } from "./library/library.schema";

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Aggregates a user's play logs (newest first) into per-game rows and overall stats.
 * Only whitelisted, non-private fields are copied — notes, reviews and purchase data never leave here.
 */
export function buildLibrary(logs: GameLogWithGame[]): LibraryResponse {
  // Newest first, so the first log seen for a game is its latest.
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
      rating: rated ? rated.rating : null,
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
