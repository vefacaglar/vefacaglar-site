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
  list(filter?: { page?: number; limit?: number }): Promise<{ items: GameWithRelations[]; total: number }>;
  update(
    id: string,
    patch: Partial<NewGame>,
    relations?: {
      developerIds?: string[];
      publisherIds?: string[];
      genreIds?: string[];
      platformIds?: string[];
      themeIds?: string[];
    }
  ): Promise<GameWithRelations>;
  delete(id: string): Promise<void>;
}
