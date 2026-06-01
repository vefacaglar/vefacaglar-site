import type { GameWithRelations } from "../../modules/catalog/games.repository.interface";
import type { Developer } from "../../modules/catalog/developers.repository.interface";
import type { Publisher } from "../../modules/catalog/publishers.repository.interface";
import type { Genre } from "../../modules/catalog/genres.repository.interface";
import type { Platform } from "../../modules/catalog/platforms.repository.interface";
import type { Theme } from "../../modules/catalog/themes.repository.interface";

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

export type { GameWithRelations, Developer, Publisher, Genre, Platform, Theme };
