import type { GameLogWithGame, LogPlaytimeActivity } from "./game-logs.repository.interface";
import type { LibraryGame, LibraryResponse } from "./library/library.schema";
import { publicCriticScore } from "./critic-score";

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Aggregates a user's play logs (newest first) into per-game rows and overall stats.
 * `playtimeActivity` holds the latest playtime entry per log and only feeds `lastActivityAt`.
 * Only whitelisted, non-private fields are copied — notes, reviews and purchase data never leave here.
 * `includeLogIds` gates `latestLogId`: only the library's owner should see log ids.
 */
export function buildLibrary(
  logs: GameLogWithGame[],
  playtimeActivity: LogPlaytimeActivity[],
  options: { includeLogIds: boolean }
): LibraryResponse {
  const lastEntryAt = new Map(playtimeActivity.map((a) => [a.userGameId, a.lastRecordedAt.getTime()]));

  // Newest first, so the first log seen for a game is its latest.
  const byGame = new Map<string, GameLogWithGame[]>();
  for (const log of logs) {
    const list = byGame.get(log.gameId);
    if (list) list.push(log);
    else byGame.set(log.gameId, [log]);
  }

  const games: LibraryGame[] = [...byGame.values()].map((gameLogs) => {
    const latest = gameLogs[0];
    const rated = gameLogs.find((l) => l.rating !== null && l.rating > 0);
    const hours = gameLogs
      .filter((l) => l.playtimeHours !== null && Number(l.playtimeHours) > 0)
      .map((l) => Number(l.playtimeHours));
    // "YYYY-MM-DD" strings sort chronologically, so the max string is the latest date.
    const completedAt = gameLogs.reduce<string | null>(
      (acc, l) => (l.completedAt !== null && (acc === null || l.completedAt > acc) ? l.completedAt : acc),
      null
    );
    const lastActivity = Math.max(
      ...gameLogs.flatMap((l) => [
        l.createdAt.getTime(),
        l.updatedAt?.getTime() ?? 0,
        lastEntryAt.get(l.id) ?? 0,
      ])
    );
    const addedAt = Math.min(...gameLogs.map((l) => l.createdAt.getTime()));
    return {
      slug: latest.game.slug,
      title: latest.game.title,
      coverImageUrl: latest.game.coverImageUrl,
      status: latest.status,
      rating: rated ? rated.rating : null,
      playtimeHours: hours.length > 0 ? round1(hours.reduce((a, b) => a + b, 0)) : null,
      logCount: gameLogs.length,
      lastLoggedAt: latest.createdAt.toISOString(),
      completedAt,
      lastActivityAt: new Date(lastActivity).toISOString(),
      platformName: gameLogs.find((l) => l.platformName !== null)?.platformName ?? null,
      criticScore: publicCriticScore(latest.game.criticScore, latest.game.criticScoreCount),
      addedAt: new Date(addedAt).toISOString(),
      latestLogId: options.includeLogIds ? latest.id : null,
    };
  });

  const platformCounts = new Map<string, number>();
  for (const game of games) {
    if (game.platformName !== null) platformCounts.set(game.platformName, (platformCounts.get(game.platformName) ?? 0) + 1);
  }
  const platforms = [...platformCounts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const ratings = games.map((g) => g.rating).filter((r): r is number => r !== null);
  return {
    summary: {
      gameCount: games.length,
      logCount: logs.length,
      completedCount: [...byGame.values()].filter((gameLogs) => gameLogs.some((l) => l.status === "completed")).length,
      playtimeHours: round1(games.reduce((sum, g) => sum + (g.playtimeHours ?? 0), 0)),
      averageRating: ratings.length > 0 ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
      platforms,
    },
    games,
  };
}
