import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { games } from "@vefacaglar/db";
import type { Developer } from "./developers.repository.interface";
import type { Publisher } from "./publishers.repository.interface";
import type { Genre } from "./genres.repository.interface";
import type { Theme } from "./themes.repository.interface";
import type { Platform } from "./platforms.repository.interface";
import type { ImportedTimes } from "./import/import.types";

export type Game = InferSelectModel<typeof games>;
export type NewGame = InferInsertModel<typeof games>;

export interface GameWithRelations extends Game {
  developers: Developer[];
  publishers: Publisher[];
  genres: Genre[];
  platforms: Platform[];
  themes: Theme[];
}

export type GameIdentity = Pick<Game, "id" | "slug" | "igdbId" | "title" | "originalTitle" | "releaseDate">;
export type LookupIdentity = { id: string; slug: string };

export type CatalogLookupKind = "developer" | "publisher" | "genre" | "platform" | "theme";
export type CatalogLookupRow = Developer | Publisher | Genre | Platform | Theme;

/** One page of an IGDB import, written in a single transaction. */
export type CatalogImportWrite = {
  /** Lookups the page references; missing ones are created, existing slugs are left alone. */
  lookups: Record<CatalogLookupKind, { name: string; slug: string }[]>;
  /** New games, with their ids already assigned. */
  newGames: NewGame[];
  gameUpdates: { id: string; patch: Partial<NewGame> }[];
  /** Game-to-lookup links by lookup slug; links that already exist are kept. */
  links: Record<CatalogLookupKind, { gameId: string; slug: string }[]>;
};

export type CatalogImportWriteResult = {
  /** Ids of `newGames` that were inserted; a row hitting a unique slug/IGDB id is skipped. */
  insertedGameIds: string[];
  /** Id and slug of every lookup the page references, and which of them were created. */
  lookups: Record<CatalogLookupKind, (LookupIdentity & { created: boolean })[]>;
};

/** Identifying columns of every game and lookup, for bulk imports that dedupe in memory. */
export interface CatalogIndex {
  games: GameIdentity[];
  developers: LookupIdentity[];
  publishers: LookupIdentity[];
  genres: LookupIdentity[];
  platforms: LookupIdentity[];
  themes: LookupIdentity[];
}

/** A game that can be matched to IGDB popularity data, with its current score. */
export type PopularitySource = {
  id: string;
  igdbId: number;
  igdbRatingCount: number | null;
  popularityScore: number | null;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  hltb: HltbPopularitySnapshot | null;
};

export type HltbPopularitySnapshot = {
  hltbId: number;
  completed: number | null;
  backlog: number | null;
  playing: number | null;
  updatedAt: Date;
};

export type HltbPopularityUpdate = HltbPopularitySnapshot & { gameId: string; times: ImportedTimes };

export type PopularitySignal = {
  gameId: string;
  popularityType: number;
  value: number;
  calculatedAt: Date | null;
};

/** One full popularity refresh, written in a single transaction. */
export type PopularityWrite = {
  /** The signals of these types are replaced wholesale by `signals`. */
  popularityTypes: number[];
  signals: PopularitySignal[];
  scores: { id: string; score: number | null }[];
  /** Only verified matches are upserted; an unavailable provider never deletes snapshots. */
  hltbUpdates: HltbPopularityUpdate[];
  updatedAt: Date;
};

/** The fields a public game card needs. */
export type GameCard = Pick<Game,
  "id" | "slug" | "title" | "coverImageUrl" | "releaseDate" | "criticScore" | "criticScoreCount" |
  "popularityScore" | "hltbMainHours" | "hltbMainExtraHours" | "hltbCompletionistHours"
>;

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
   * Public listing, including announced games. Without `q`, current interest first;
   * with `q`, title matches ranked exact > prefix > substring, then by popularity.
   */
  listPublic(filter: { page: number; limit: number; q?: string }): Promise<{ items: GameCard[]; total: number }>;

  /** Loads ids and slugs (and game titles) of the whole catalog in one round of queries. */
  loadCatalogIndex(): Promise<CatalogIndex>;

  /** Loads many games with their relations in a fixed number of queries. */
  findByIds(ids: string[]): Promise<GameWithRelations[]>;
  findLookupsByIds(kind: CatalogLookupKind, ids: string[]): Promise<CatalogLookupRow[]>;
  /** Every game linked to IGDB, with what the popularity refresh needs. */
  listPopularitySources(): Promise<PopularitySource[]>;
  /** Replaces the popularity signals and writes every score in one transaction. Publishes no events. */
  writePopularity(write: PopularityWrite): Promise<void>;

  /** Bulk-writes one import page in a single transaction. Publishes no events. */
  writeImportPage(write: CatalogImportWrite): Promise<CatalogImportWriteResult>;

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
