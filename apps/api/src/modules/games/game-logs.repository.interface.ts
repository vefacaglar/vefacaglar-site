import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { userGames } from "@vefacaglar/db";

export type GameLogRow = InferSelectModel<typeof userGames>;
export type NewGameLog = InferInsertModel<typeof userGames>;
export type GameLogWithPlatform = GameLogRow & { platformName: string | null };
export type GameLogWithGame = GameLogWithPlatform & {
  game: { slug: string; title: string; coverImageUrl: string | null };
};

/** A user's play logs for a game (`user_games`); a user can log the same game many times. */
export interface IGameLogsRepository {
  listForUserGame(userId: string, gameId: string): Promise<GameLogWithPlatform[]>;
  /** Every log of a user across all games, newest first. */
  listForUser(userId: string): Promise<GameLogWithGame[]>;
  findById(id: string): Promise<GameLogWithPlatform | null>;
  create(values: NewGameLog): Promise<GameLogWithPlatform>;
  update(id: string, patch: Partial<NewGameLog>): Promise<GameLogWithPlatform>;
  delete(id: string): Promise<void>;
}
