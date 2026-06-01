import type {
  SearchQuery,
  SearchResult,
  GameSearchItem,
  Developer,
  Publisher,
  Genre,
  Platform,
  Theme,
} from "../search.types";

/**
 * Query side (CQRS read model). Consumed by the dashboard list handlers; only
 * exposes read operations against the search index.
 */
export interface ISearchReader {
  searchGames(query: SearchQuery): Promise<SearchResult<GameSearchItem>>;
  searchDevelopers(query: SearchQuery): Promise<SearchResult<Developer>>;
  searchPublishers(query: SearchQuery): Promise<SearchResult<Publisher>>;
  searchGenres(query: SearchQuery): Promise<SearchResult<Genre>>;
  searchPlatforms(query: SearchQuery): Promise<SearchResult<Platform>>;
  searchThemes(query: SearchQuery): Promise<SearchResult<Theme>>;
}
