/**
 * Command side (CQRS write model maintenance). Consumed by the domain-event
 * subscriber and the reindex script to keep the search index in sync; only
 * exposes index/remove/reindex operations.
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

  removeGame(id: string): Promise<void>;
  removePost(id: string): Promise<void>;
  removeDeveloper(id: string): Promise<void>;
  removePublisher(id: string): Promise<void>;
  removeGenre(id: string): Promise<void>;
  removePlatform(id: string): Promise<void>;
  removeTheme(id: string): Promise<void>;

  reindexAll(options: { drop: boolean }): Promise<void>;
}
