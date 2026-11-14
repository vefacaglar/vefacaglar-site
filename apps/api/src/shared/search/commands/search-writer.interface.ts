/**
 * Command side (CQRS write model maintenance). Consumed by the domain-event
 * subscriber to keep the search index in sync with incremental per-document
 * writes into existing indexes. Index creation, settings and full rebuilds are
 * worker jobs (see docs/jobs-worker.md) and intentionally not part of this
 * interface; a write to an index that does not exist yet is skipped.
 */
export interface ISearchIndexWriter {
  readonly enabled: boolean;

  indexGame(id: string): Promise<void>;
  indexPost(id: string): Promise<void>;
  indexDeveloper(id: string): Promise<void>;
  indexPublisher(id: string): Promise<void>;
  indexGenre(id: string): Promise<void>;
  indexPlatform(id: string): Promise<void>;
  indexTheme(id: string): Promise<void>;

  /** Batch variants for bulk imports: one document batch per index slice. */
  indexGames(ids: string[], options?: { throwOnError?: boolean }): Promise<void>;
  indexLookups(kind: "developer" | "publisher" | "genre" | "platform" | "theme", ids: string[]): Promise<void>;

  removeGame(id: string): Promise<void>;
  removePost(id: string): Promise<void>;
  removeDeveloper(id: string): Promise<void>;
  removePublisher(id: string): Promise<void>;
  removeGenre(id: string): Promise<void>;
  removePlatform(id: string): Promise<void>;
  removeTheme(id: string): Promise<void>;
}
