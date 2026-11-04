import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { userGames } from "@vefacaglar/db";
import type { PlaytimeIncrease } from "./playtime-delta";

export type GameLogRow = InferSelectModel<typeof userGames>;
export type NewGameLog = InferInsertModel<typeof userGames>;
export type GameLogWithPlatform = GameLogRow & { platformName: string | null };
export type GameLogWithGame = GameLogWithPlatform & {
  game: { slug: string; title: string; coverImageUrl: string | null };
};
/** When playtime was last added to a log (latest `user_game_playtime_entries.recorded_at`). */
export type LogPlaytimeActivity = { userGameId: string; lastRecordedAt: Date };

/** A user's play logs for a game (`user_games`); a user can log the same game many times. */
export interface IGameLogsRepository {
  listForUserGame(userId: string, gameId: string): Promise<GameLogWithPlatform[]>;
  /** Every log of a user across all games, newest first. */
  listForUser(userId: string): Promise<GameLogWithGame[]>;
  /** Latest playtime entry per log of a user, in one grouped query. Logs without entries are omitted. */
  listPlaytimeActivityForUser(userId: string): Promise<LogPlaytimeActivity[]>;
  findById(id: string): Promise<GameLogWithPlatform | null>;
  /** Inserts the log and, when given, its playtime audit entry in one transaction. */
  create(values: NewGameLog, playtime: PlaytimeIncrease | null): Promise<GameLogWithPlatform>;
  /** Updates the log and, when given, records its playtime audit entry in one transaction. */
  update(id: string, patch: Partial<NewGameLog>, playtime: PlaytimeIncrease | null): Promise<GameLogWithPlatform>;
  delete(id: string): Promise<void>;
}
