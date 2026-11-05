import { games, platforms, userGamePlaytimeEntries, userGames } from "@vefacaglar/db";
import { and, desc, eq } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  GameLogRow,
  GameLogWithGame,
  GameLogWithPlatform,
  IGameLogsRepository,
  LogPlaytimeActivity,
  NewGameLog,
} from "./game-logs.repository.interface";
import type { PlaytimeIncrease } from "./playtime-delta";

@injectable()
export class DrizzleGameLogsRepository implements IGameLogsRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private selectWithPlatform() {
    return this.dbProvider.client
      .select({ log: userGames, platformName: platforms.name })
      .from(userGames)
      .leftJoin(platforms, eq(userGames.platformId, platforms.id));
  }

  async listForUserGame(userId: string, gameId: string): Promise<GameLogWithPlatform[]> {
    const rows = await this.selectWithPlatform()
      .where(and(eq(userGames.userId, userId), eq(userGames.gameId, gameId)))
      .orderBy(desc(userGames.createdAt));
    return rows.map((r) => ({ ...r.log, platformName: r.platformName }));
  }

  async listForUser(userId: string): Promise<GameLogWithGame[]> {
    const rows = await this.dbProvider.client
      .select({
        log: userGames,
        platformName: platforms.name,
        game: {
          slug: games.slug,
          title: games.title,
          coverImageUrl: games.coverImageUrl,
          criticScore: games.criticScore,
          criticScoreCount: games.criticScoreCount,
        },
      })
      .from(userGames)
      .innerJoin(games, eq(userGames.gameId, games.id))
      .leftJoin(platforms, eq(userGames.platformId, platforms.id))
      .where(eq(userGames.userId, userId))
      .orderBy(desc(userGames.createdAt));
    return rows.map((r) => ({ ...r.log, platformName: r.platformName, game: r.game }));
  }

  async listPlaytimeActivityForUser(userId: string): Promise<LogPlaytimeActivity[]> {
    const rows = await this.dbProvider.client
      .select({
        id: userGamePlaytimeEntries.id,
        userGameId: userGamePlaytimeEntries.userGameId,
        status: userGamePlaytimeEntries.status,
        deltaHours: userGamePlaytimeEntries.deltaHours,
        lastRecordedAt: userGamePlaytimeEntries.recordedAt,
      })
      .from(userGamePlaytimeEntries)
      .where(eq(userGamePlaytimeEntries.userId, userId))
      .orderBy(desc(userGamePlaytimeEntries.recordedAt));
    return rows.map((r) => ({
      id: r.id,
      userGameId: r.userGameId,
      status: r.status,
      deltaHours: r.deltaHours,
      lastRecordedAt: new Date(r.lastRecordedAt),
    }));
  }

  async findById(id: string): Promise<GameLogWithPlatform | null> {
    const [row] = await this.selectWithPlatform().where(eq(userGames.id, id)).limit(1);
    return row ? { ...row.log, platformName: row.platformName } : null;
  }

  async create(values: NewGameLog, playtime: PlaytimeIncrease | null): Promise<GameLogWithPlatform> {
    return this.dbProvider.transaction(async () => {
      const [created] = await this.dbProvider.client.insert(userGames).values(values).returning();
      await this.recordPlaytime(created, playtime);
      return (await this.findById(created.id))!;
    });
  }

  async update(id: string, patch: Partial<NewGameLog>, playtime: PlaytimeIncrease | null): Promise<GameLogWithPlatform> {
    return this.dbProvider.transaction(async () => {
      const [updated] = await this.dbProvider.client.update(userGames).set(patch).where(eq(userGames.id, id)).returning();
      if (playtime) {
        await this.recordPlaytime(updated, playtime);
      } else if (updated && patch.status) {
        const [latestEntry] = await this.dbProvider.client
          .select({ id: userGamePlaytimeEntries.id })
          .from(userGamePlaytimeEntries)
          .where(eq(userGamePlaytimeEntries.userGameId, id))
          .orderBy(desc(userGamePlaytimeEntries.recordedAt))
          .limit(1);
        if (latestEntry) {
          await this.dbProvider.client
            .update(userGamePlaytimeEntries)
            .set({ status: updated.status })
            .where(eq(userGamePlaytimeEntries.id, latestEntry.id));
        }
      }
      return (await this.findById(id))!;
    });
  }

  async delete(id: string): Promise<void> {
    await this.dbProvider.client.delete(userGames).where(eq(userGames.id, id));
  }

  private async recordPlaytime(log: GameLogRow | undefined, playtime: PlaytimeIncrease | null): Promise<void> {
    if (!log || !playtime) return;
    await this.dbProvider.client.insert(userGamePlaytimeEntries).values({
      userGameId: log.id,
      userId: log.userId,
      gameId: log.gameId,
      status: log.status,
      deltaHours: playtime.deltaHours,
      previousHours: playtime.previousHours,
      newHours: playtime.newHours,
    });
  }
}
