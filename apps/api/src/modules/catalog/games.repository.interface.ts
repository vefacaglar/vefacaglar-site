import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { games } from "@vefacaglar/db";
import type { Developer } from "./developers.repository.interface";
import type { Publisher } from "./publishers.repository.interface";
import type { Genre } from "./genres.repository.interface";
import type { Theme } from "./themes.repository.interface";
import type { Platform } from "./platforms.repository.interface";

export type Game = InferSelectModel<typeof games>;
export type NewGame = InferInsertModel<typeof games>;

export interface GameWithRelations extends Game {
  developers: Developer[];
  publishers: Publisher[];
  genres: Genre[];
  platforms: Platform[];
  themes: Theme[];
}

export type GameIdentity = Pick<Game, "id" | "slug" | "title" | "originalTitle" | "releaseDate">;
export type LookupIdentity = { id: string; slug: string };

/** Identifying columns of every game and lookup, for bulk imports that dedupe in memory. */
export interface CatalogIndex {
  games: GameIdentity[];
  developers: LookupIdentity[];
  publishers: LookupIdentity[];
  genres: LookupIdentity[];
  platforms: LookupIdentity[];
  themes: LookupIdentity[];
}

/** The fields a public game card needs. */
export type GameCard = Pick<Game, "id" | "slug" | "title" | "coverImageUrl" | "releaseDate">;

export interface IGamesRepository {
  create(
    values: NewGame,
    relations: {
      developerIds?: string[];
      publisherIds?: string[];
      genreIds?: string[];
      platformIds?: string[];
      themeIds?: string[];
    }
  ): Promise<GameWithRelations>;
  findById(id: string): Promise<GameWithRelations | null>;
  findBySlug(slug: string): Promise<GameWithRelations | null>;
  list(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: GameWithRelations[]; total: number }>;
  update(id: string, patch: Partial<NewGame>): Promise<GameWithRelations>;
  delete(id: string): Promise<void>;

  /**
   * Returns the ids of all games linked to the given lookup entity. Used to
   * cascade-reindex denormalized game documents when a lookup is renamed.
   */
  findGameIdsByRelation(
    relation: "developer" | "publisher" | "genre" | "platform" | "theme",
    relatedId: string
  ): Promise<string[]>;

  /**
   * Public listing. Without `q`, released games newest first; with `q`, title
   * matches ranked exact > prefix > substring, then newest first.
   */
  listPublic(filter: { page: number; limit: number; q?: string }): Promise<{ items: GameCard[]; total: number }>;

  /** Loads ids and slugs (and game titles) of the whole catalog in one round of queries. */
  loadCatalogIndex(): Promise<CatalogIndex>;

  linkDeveloper(gameId: string, developerId: string): Promise<void>;
  unlinkDeveloper(gameId: string, developerId: string): Promise<void>;
  linkPublisher(gameId: string, publisherId: string): Promise<void>;
  unlinkPublisher(gameId: string, publisherId: string): Promise<void>;
  linkGenre(gameId: string, genreId: string): Promise<void>;
  unlinkGenre(gameId: string, genreId: string): Promise<void>;
  linkPlatform(gameId: string, platformId: string): Promise<void>;
  unlinkPlatform(gameId: string, platformId: string): Promise<void>;
  linkTheme(gameId: string, themeId: string): Promise<void>;
  unlinkTheme(gameId: string, themeId: string): Promise<void>;
}
