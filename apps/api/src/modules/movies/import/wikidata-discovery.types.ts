export const MOVIE_DISCOVERY_CLIENT = Symbol.for("MOVIE_DISCOVERY_CLIENT");
export const FILM_DISCOVERY_STRATEGY = "wikidata-direct-film-v1";

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
