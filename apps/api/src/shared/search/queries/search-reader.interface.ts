import type { GameCard, GameCompanyRole, PublicCompanyMatch } from "../../../modules/catalog/games.repository.interface";
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
   * Public /games list, including announced games. Without `q`, current interest
   * first; with `q`, best title matches first, then current interest. Falls back to Postgres when Meilisearch is down.
   */
  searchPublicGames(query: SearchQuery): Promise<SearchResult<GameCard>>;
  /**
   * Public developer or publisher search: Meilisearch ranking score, ties broken by game count,
   * with current fields and game counts from Postgres. Only companies with at least one game.
   * Search pages are read (at most three) until the limit is filled after dropping companies without games.
   * Falls back to a ranked Postgres word-prefix name search when Meilisearch is disabled or fails before any result.
   */
  searchPublicCompanies(role: GameCompanyRole, query: { q: string; limit: number }): Promise<PublicCompanyMatch[]>;
  searchPosts(query: SearchQuery): Promise<SearchResult<PostSearchItem>>;
  searchDevelopers(query: SearchQuery): Promise<SearchResult<Developer>>;
  searchPublishers(query: SearchQuery): Promise<SearchResult<Publisher>>;
  searchGenres(query: SearchQuery): Promise<SearchResult<Genre>>;
  searchPlatforms(query: SearchQuery): Promise<SearchResult<Platform>>;
  searchThemes(query: SearchQuery): Promise<SearchResult<Theme>>;
}
