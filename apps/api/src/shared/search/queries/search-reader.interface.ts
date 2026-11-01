import type { GameCard } from "../../../modules/catalog/games.repository.interface";
import type {
  SearchQuery,
  SearchResult,
  GameSearchItem,
  PostSearchItem,
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
  /**
   * Public /games list. Without `q`, released games newest first; with `q`,
   * best title matches first. Falls back to Postgres when Typesense is down.
   */
  searchPublicGames(query: SearchQuery): Promise<SearchResult<GameCard>>;
  searchPosts(query: SearchQuery): Promise<SearchResult<PostSearchItem>>;
  searchDevelopers(query: SearchQuery): Promise<SearchResult<Developer>>;
  searchPublishers(query: SearchQuery): Promise<SearchResult<Publisher>>;
  searchGenres(query: SearchQuery): Promise<SearchResult<Genre>>;
  searchPlatforms(query: SearchQuery): Promise<SearchResult<Platform>>;
  searchThemes(query: SearchQuery): Promise<SearchResult<Theme>>;
}
