export const GAME_COMPLETION_TIMES_CLIENT = Symbol("GameCompletionTimesClient");
export const GAME_COMPLETION_TIMES_REPOSITORY = Symbol("GameCompletionTimesRepository");

export type GameCompletionTimesRow = {
  igdbId: number;
  sourceId: number;
  hastilySeconds: number | null;
  normallySeconds: number | null;
  completelySeconds: number | null;
  sampleCount: number;
  sourceUpdatedAt: Date | null;
};

export interface IGameCompletionTimesClient {
  collect(): Promise<GameCompletionTimesRow[]>;
}
export interface IGameCompletionTimesRepository {
  publish(rows: GameCompletionTimesRow[], refreshedAt: Date): Promise<{ matchedGames: number; usableGames: number }>;
}
