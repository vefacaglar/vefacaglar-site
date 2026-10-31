export type ImportedLookup = { name: string; slug: string };

/** A game record normalized from an external catalog source (IGDB). */
export type ImportedGame = {
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  releaseDate: string | null;
  developers: ImportedLookup[];
  publishers: ImportedLookup[];
  genres: ImportedLookup[];
  platforms: ImportedLookup[];
  themes: ImportedLookup[];
};

/** Completion times in hours, as reported by HowLongToBeat. */
export type ImportedTimes = {
  mainHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
};

export interface IIgdbClient {
  findGame(query: string): Promise<ImportedGame | null>;
}

export interface IHltbClient {
  findTimes(title: string): Promise<ImportedTimes | null>;
}

/** Lowercase alphanumerics only, so "The Witcher 3: Wild Hunt" matches "the witcher 3 wild hunt". */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}
