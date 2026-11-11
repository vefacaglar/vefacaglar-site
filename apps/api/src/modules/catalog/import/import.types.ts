export type ImportedLookup = { name: string; slug: string };

/** A game record normalized from an external catalog source (IGDB). */
export type ImportedGame = {
  igdbId: number;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  releaseDate: string | null;
  /** Average external critic rating, 0-100, rounded. */
  criticScore: number | null;
  criticScoreCount: number | null;
  /** IGDB `total_rating_count` (user + critic ratings); changes over time, so it is always refreshed. */
  ratingCount: number | null;
  /** Explicit IGDB mode ids; missing means this import did not fetch modes. */
  gameModeIds?: number[];
  developers: ImportedLookup[];
  publishers: ImportedLookup[];
  genres: ImportedLookup[];
  platforms: ImportedLookup[];
  themes: ImportedLookup[];
};

export type ImportedGamePage = {
  /** IGDB id of the last raw row in the page; pass it back as `afterId`. Null when the catalog is exhausted. */
  lastId: number | null;
  games: ImportedGame[];
};

/** One IGDB popularity primitive: a game's value for one popularity type. */
export type PopularityPrimitive = {
  igdbId: number;
  popularityType: number;
  value: number;
  calculatedAt: Date | null;
};

export interface IIgdbClient {
  findGame(query: string): Promise<ImportedGame | null>;
  /** Walks the whole IGDB catalog in id order, one page per call. */
  listGames(afterId: number, options?: { minRatings?: number }): Promise<ImportedGamePage>;
  /**
   * All popularity primitives of the given types, globally keyset-paginated by
   * primitive id. The caller matches them to its catalog. No partial result is returned.
   */
  listPopularity(popularityTypes: number[]): Promise<PopularityPrimitive[]>;
  /** At most 500 explicit ids; omitted games are not reported as empty modes. */
  listGameModes(igdbIds: number[], signal?: AbortSignal): Promise<{ igdbId: number; gameModeIds: number[] }[]>;
}

/** Lowercase alphanumerics only, so "The Witcher 3: Wild Hunt" matches "the witcher 3 wild hunt". */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}
