import type { GameCommunityEntry } from "./community.schema";
export type GameCommunityEntryRow = Omit<GameCommunityEntry, "sharedAt"> & { sharedAt: Date };
export interface IGameCommunityRepository {
  findPublicGameId(slug: string): Promise<string | null>;
  getCommunity(gameId: string, page: number, limit: number): Promise<{
    rating: { average: number | null; count: number };
    entries: GameCommunityEntryRow[];
    total: number;
  }>;
}
