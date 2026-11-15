export const MOVIE_DISCOVERY_CLIENT = Symbol.for("MOVIE_DISCOVERY_CLIENT");
export const FILM_DISCOVERY_STRATEGY = "wikidata-film-classes-v2";
/** Wikidata classes (direct P31 only, no subclass traversal) that make an item a film: film, animated film. */
export const FILM_CLASS_QIDS = ["Q11424", "Q202866"] as const;

export interface FilmDiscoveryResult {
  complete: boolean;
  discovered: number;
  strategy: string;
}
export interface IFilmDiscoveryClient {
  /** Callbacks must durably upsert stubs. Restarting replays this unordered projection. */
  discover(
    onBatch: (wikidataIds: string[]) => Promise<void>,
    options?: { signal?: AbortSignal; maxRequests?: number },
  ): Promise<FilmDiscoveryResult>;
}
