import { reportRuntimeFailure } from "../../application-logs/runtime-failures";
import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import type { Developer } from "../../../modules/catalog/developers.repository.interface";
import type { Publisher } from "../../../modules/catalog/publishers.repository.interface";
import type { Genre } from "../../../modules/catalog/genres.repository.interface";
import type { Platform } from "../../../modules/catalog/platforms.repository.interface";
import type { Theme } from "../../../modules/catalog/themes.repository.interface";
import {
  DEVELOPERS_REPOSITORY,
  PUBLISHERS_REPOSITORY,
  GENRES_REPOSITORY,
  PLATFORMS_REPOSITORY,
  THEMES_REPOSITORY,
  GAMES_REPOSITORY,
} from "../../../modules/catalog/catalog.tokens";
import { POSTS_REPOSITORY } from "../../../modules/posts/posts.tokens";
import type { IDevelopersRepository } from "../../../modules/catalog/developers.repository.interface";
import type { IPublishersRepository } from "../../../modules/catalog/publishers.repository.interface";
import type { IGenresRepository } from "../../../modules/catalog/genres.repository.interface";
import type { IPlatformsRepository } from "../../../modules/catalog/platforms.repository.interface";
import type { IThemesRepository } from "../../../modules/catalog/themes.repository.interface";
import type { IGamesRepository } from "../../../modules/catalog/games.repository.interface";
import type { IPostsRepository } from "../../../modules/posts/posts.repository.interface";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, type TypesenseConfig } from "../search.tokens";
import { buildAllCollectionSchemas, SEARCH_COLLECTIONS } from "../collections";
import type { ISearchIndexWriter } from "./search-writer.interface";
import { toGameDoc } from "../mappers/game.mapper";
import { toPostDoc } from "../mappers/post.mapper";
import {
  toDeveloperDoc,
  toPublisherDoc,
  toGenreDoc,
  toPlatformDoc,
  toThemeDoc,
  type DeveloperDoc,
  type PublisherDoc,
  type GenreDoc,
  type PlatformDoc,
  type ThemeDoc,
} from "../mappers/lookup.mapper";

// One crawl page (500 games) fits in a single bulk index pass.
const BULK_INDEX_SIZE = 500;

type LookupEntity = "developer" | "publisher" | "genre" | "platform" | "theme";
type LookupRow = Developer | Publisher | Genre | Platform | Theme;
type LookupDoc = DeveloperDoc | PublisherDoc | GenreDoc | PlatformDoc | ThemeDoc;

const LOOKUP_COLLECTIONS: Record<LookupEntity, string> = {
  developer: SEARCH_COLLECTIONS.developers,
  publisher: SEARCH_COLLECTIONS.publishers,
  genre: SEARCH_COLLECTIONS.genres,
  platform: SEARCH_COLLECTIONS.platforms,
  theme: SEARCH_COLLECTIONS.themes,
};

@injectable()
export class TypesenseSearchWriter implements ISearchIndexWriter {
  readonly enabled: boolean;

  constructor(
    @inject(TYPESENSE_CLIENT) private readonly typesense: TypesenseClient,
    @inject(TYPESENSE_CONFIG) typesenseConfig: TypesenseConfig,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository
  ) {
    this.enabled = typesenseConfig.enabled;
  }

  // --- Public index methods ---

  async indexGame(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const game = await this.gamesRepo.findById(id);
      if (!game) {
        await this.removeGame(id);
        return;
      }
      await this.typesense.collections(SEARCH_COLLECTIONS.games).documents().upsert(toGameDoc(game));
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index game", err);
    }
  }

  async indexPost(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const post = await this.postsRepo.findByIdWithAuthor(id);
      if (!post || post.status !== "published") {
        await this.removePost(id);
        return;
      }
      await this.typesense.collections(SEARCH_COLLECTIONS.posts).documents().upsert(toPostDoc(post));
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index post", err);
    }
  }

  async indexDeveloper(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const dev = await this.developersRepo.findById(id);
      if (!dev) {
        await this.removeDeveloper(id);
        return;
      }
      await this.upsertLookup("developer", id, dev);
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index developer", err);
    }
  }

  async indexPublisher(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const pub = await this.publishersRepo.findById(id);
      if (!pub) {
        await this.removePublisher(id);
        return;
      }
      await this.upsertLookup("publisher", id, pub);
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index publisher", err);
    }
  }

  async indexGenre(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const genre = await this.genresRepo.findById(id);
      if (!genre) {
        await this.removeGenre(id);
        return;
      }
      await this.upsertLookup("genre", id, genre);
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index genre", err);
    }
  }

  async indexPlatform(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const platform = await this.platformsRepo.findById(id);
      if (!platform) {
        await this.removePlatform(id);
        return;
      }
      await this.upsertLookup("platform", id, platform);
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index platform", err);
    }
  }

  async indexTheme(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const theme = await this.themesRepo.findById(id);
      if (!theme) {
        await this.removeTheme(id);
        return;
      }
      await this.upsertLookup("theme", id, theme);
    } catch (err) {
      reportRuntimeFailure("search_index_failed", "Could not index theme", err);
    }
  }

  async indexGames(ids: string[], options: { throwOnError?: boolean } = {}): Promise<void> {
    if (options.throwOnError && !this.enabled) throw new Error("Typesense must be configured for popularity search synchronization");
    await this.bulkIndex(SEARCH_COLLECTIONS.games, ids, (sliceIds) => this.gamesRepo.findByIds(sliceIds), toGameDoc, options.throwOnError);
  }

  async indexLookups(kind: LookupEntity, ids: string[]): Promise<void> {
    await this.bulkIndex(LOOKUP_COLLECTIONS[kind], ids, (sliceIds) => this.gamesRepo.findLookupsByIds(kind, sliceIds), (row) =>
      this.toLookupDoc(kind, row)
    );
  }

  /** Loads and imports the rows one slice at a time: a bulk import costs a few round trips, not one per row. */
  private async bulkIndex<T extends { id: string }>(
    collection: string,
    ids: string[],
    load: (ids: string[]) => Promise<T[]>,
    toDoc: (row: T) => object,
    throwOnError = false
  ): Promise<void> {
    if (!this.enabled || ids.length === 0) return;
    for (let i = 0; i < ids.length; i += BULK_INDEX_SIZE) {
      const sliceIds = ids.slice(i, i + BULK_INDEX_SIZE);
      try {
        const rows = await load(sliceIds);
        await this.bulkImportDocs(collection, rows.map(toDoc), throwOnError);
      } catch (err) {
        reportRuntimeFailure("search_bulk_index_failed", `Could not bulk index ${collection}`, err);
        if (throwOnError) throw err;
      }
    }
  }

  private async upsertLookup(entityName: LookupEntity, id: string, row: LookupRow): Promise<void> {
    try {
      await this.typesense.collections(LOOKUP_COLLECTIONS[entityName]).documents().upsert(this.toLookupDoc(entityName, row));
    } catch (err) {
      reportRuntimeFailure("search_index_failed", `Could not index ${entityName}`, err);
    }

    // Game documents denormalize lookup names (developerNames, genreNames, …),
    // so a rename must cascade to every game that references this lookup.
    await this.reindexGamesForLookup(entityName, id);
  }

  private async reindexGamesForLookup(relation: LookupEntity, id: string): Promise<void> {
    try {
      const gameIds = await this.gamesRepo.findGameIdsByRelation(relation, id);
      for (const gameId of gameIds) {
        await this.indexGame(gameId);
      }
    } catch (err) {
      reportRuntimeFailure("search_cascade_failed", `Could not reindex games related to a ${relation}`, err);
    }
  }

  private toLookupDoc(entityName: LookupEntity, row: LookupRow): LookupDoc {
    switch (entityName) {
      case "developer": return toDeveloperDoc(row as Developer);
      case "publisher": return toPublisherDoc(row as Publisher);
      case "genre": return toGenreDoc(row as Genre);
      case "platform": return toPlatformDoc(row as Platform);
      case "theme": return toThemeDoc(row as Theme);
    }
  }

  // --- Public remove methods ---

  async removeGame(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.games, id);
  }

  async removePost(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.posts, id);
  }

  async removeDeveloper(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.developers, id);
  }

  async removePublisher(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.publishers, id);
  }

  async removeGenre(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.genres, id);
  }

  async removePlatform(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.platforms, id);
  }

  async removeTheme(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_COLLECTIONS.themes, id);
  }

  private async removeDocument(collectionName: string, id: string): Promise<void> {
    try {
      await this.typesense.collections(collectionName).documents(id).delete();
    } catch (err) {
      const status = (err as { httpStatus?: number }).httpStatus;
      if (status === 404) return;
      reportRuntimeFailure("search_delete_failed", `Could not delete a document from ${collectionName}`, err);
    }
  }

  // --- Collection bootstrap ---

  /**
   * Creates missing collections; never deletes or recreates anything. Full
   * reindexing (including zero-downtime alias swaps) is owned by the worker's
   * `search.reindex` job (docs/jobs-worker.md), so a name that resolves to an
   * alias counts as present and no real collection is ever created over it.
   */
  async ensureCollections(): Promise<void> {
    if (!this.enabled) return;
    for (const schema of buildAllCollectionSchemas()) {
      try {
        if (await this.aliasExists(schema.name)) continue;
        if (await this.collectionExists(schema.name)) continue;
        await this.typesense.collections().create(schema);
        console.log(`[search] created collection ${schema.name}`);
      } catch (err) {
        const status = (err as { httpStatus?: number }).httpStatus;
        const msg = (err as Error).message ?? "";
        // Created concurrently (another instance or the worker); nothing to do.
        if (status === 409 || msg.includes("already exists")) continue;
        reportRuntimeFailure("search_collection_bootstrap_failed", `Could not prepare search collection ${schema.name}`, err);
      }
    }
    console.log("[search] collections ready");
  }

  private async aliasExists(name: string): Promise<boolean> {
    return this.exists(() => this.typesense.aliases(name).retrieve());
  }

  private async collectionExists(name: string): Promise<boolean> {
    return this.exists(() => this.typesense.collections(name).retrieve());
  }

  /** `true` if the lookup succeeds, `false` on 404; other errors propagate. */
  private async exists(lookup: () => Promise<unknown>): Promise<boolean> {
    try {
      await lookup();
      return true;
    } catch (err) {
      if ((err as { httpStatus?: number }).httpStatus === 404) return false;
      throw err;
    }
  }

  // --- Private: bulk import helper ---

  private async bulkImportDocs(collectionName: string, docs: object[], throwOnError = false): Promise<void> {
    if (docs.length === 0) return;
    try {
      const results = await this.typesense
        .collections(collectionName)
        .documents()
        .import(docs, { action: "upsert" });
      // Typesense reports per-document outcomes in the results array without
      // throwing, so partial failures are otherwise silent. Surface them.
      const failures = Array.isArray(results)
        ? results.filter((r) => r && (r as { success?: boolean }).success === false)
        : [];
      if (failures.length > 0) {
        const firstError = (failures[0] as { error?: string }).error ?? "unknown";
        reportRuntimeFailure(
          "search_bulk_import_partial_failure",
          `Typesense rejected ${failures.length} of ${docs.length} documents for ${collectionName}`,
          new Error(firstError),
        );
        if (throwOnError) throw new Error(`Typesense rejected ${failures.length} documents during popularity synchronization`);
      }
    } catch (err) {
      reportRuntimeFailure("search_bulk_import_failed", `Could not import documents into ${collectionName}`, err);
      if (throwOnError) throw err;
    }
  }
}
