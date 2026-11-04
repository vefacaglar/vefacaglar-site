import { games, platforms, userGamePlaytimeEntries, userGames } from "@vefacaglar/db";
import { and, desc, eq, max } from "drizzle-orm";
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
        game: { slug: games.slug, title: games.title, coverImageUrl: games.coverImageUrl },
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
        userGameId: userGamePlaytimeEntries.userGameId,
        lastRecordedAt: max(userGamePlaytimeEntries.recordedAt),
      })
      .from(userGamePlaytimeEntries)
      .where(eq(userGamePlaytimeEntries.userId, userId))
      .groupBy(userGamePlaytimeEntries.userGameId);
    return rows
      .filter((r): r is LogPlaytimeActivity => r.lastRecordedAt !== null)
      .map((r) => ({ userGameId: r.userGameId, lastRecordedAt: new Date(r.lastRecordedAt) }));
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
      await this.recordPlaytime(updated, playtime);
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
      deltaHours: playtime.deltaHours,
      previousHours: playtime.previousHours,
      newHours: playtime.newHours,
    });
  }
}
