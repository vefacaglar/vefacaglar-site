export const MOVIE_SOURCE_ID = "wikidata-films-v1";
export const MOVIE_SEEDS = ["Q47703", "Q163872", "Q172241", "Q104123", "Q127367"];
export type MovieRole = "P161" | "P57" | "P162";
export type StatementRank = "preferred" | "normal" | "deprecated";
export type SourceCredit = { statementId: string; personQid: string; roleProperty: MovieRole; rank: StatementRank; qualifiers: Record<string, unknown>; characterNames: string[]; characterQids: string[] };
export type NormalizedMovie = {
  wikidataId: string; title: string; originalTitle: string | null; description: string | null;
  imdbId: string | null; imdbConflict: boolean;
  posterFileName: string | null;
  enwikiArticle: string | null;
  releaseDate: string | null; releaseYear: number | null; releasePrecision: number | null;
  runtimeMinutes: number | null; isFilm: boolean; sourceRevision: number | null; sourceModifiedAt: Date | null;
  credits: SourceCredit[]; companyQids: string[]; genreQids: string[];
};
export type EntityLabels = Record<string, string | null>;
export interface IWikidataEntityClient {
  fetchEntities(qids: string[], options?: { signal?: AbortSignal }): Promise<Record<string, unknown>>;
  fetchLabels(qids: string[], options?: { signal?: AbortSignal }): Promise<EntityLabels>;
}
