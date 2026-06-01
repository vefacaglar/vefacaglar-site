import type { GameWithRelations } from "../../modules/games/games.repository.interface";
import type { Developer, NewDeveloper } from "../../modules/games/developers.repository.interface";
import type { Publisher, NewPublisher } from "../../modules/games/publishers.repository.interface";
import type { Genre, NewGenre } from "../../modules/games/genres.repository.interface";
import type { Platform, NewPlatform } from "../../modules/games/platforms.repository.interface";
import type { Theme, NewTheme } from "../../modules/games/themes.repository.interface";

export type SearchLanguage = "en" | "tr";

export interface SearchResult<T> {
  items: T[];
  total: number;
}

export interface SearchQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export type GameSearchItem = GameWithRelations;
export type LookupSearchItem =
  | Developer
  | Publisher
  | Genre
  | Platform
  | Theme;

export interface ISearchIndexer {
  readonly enabled: boolean;
  searchGames(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<GameSearchItem>>;
  searchDevelopers(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Developer>>;
  searchPublishers(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Publisher>>;
  searchGenres(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Genre>>;
  searchPlatforms(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Platform>>;
  searchThemes(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Theme>>;

  indexGame(id: string): Promise<void>;
  indexDeveloper(id: string): Promise<void>;
  indexPublisher(id: string): Promise<void>;
  indexGenre(id: string): Promise<void>;
  indexPlatform(id: string): Promise<void>;
  indexTheme(id: string): Promise<void>;

  removeGame(id: string): Promise<void>;
  removeDeveloper(id: string): Promise<void>;
  removePublisher(id: string): Promise<void>;
  removeGenre(id: string): Promise<void>;
  removePlatform(id: string): Promise<void>;
  removeTheme(id: string): Promise<void>;

  reindexAll(options: { drop: boolean }): Promise<void>;
}

export type { GameWithRelations, Developer, NewDeveloper, Publisher, NewPublisher, Genre, NewGenre, Platform, NewPlatform, Theme, NewTheme };
