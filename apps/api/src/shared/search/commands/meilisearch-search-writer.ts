import { reportRuntimeFailure } from "../../application-logs/runtime-failures";
import { inject, injectable } from "tsyringe";
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
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, type MeilisearchConfig } from "../search.tokens";
import { MeilisearchError, type ISearchClient } from "../meilisearch.client";
import { SEARCH_INDEXES } from "../search.indexes";
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

const LOOKUP_INDEXES: Record<LookupEntity, string> = {
  developer: SEARCH_INDEXES.developers,
  publisher: SEARCH_INDEXES.publishers,
  genre: SEARCH_INDEXES.genres,
  platform: SEARCH_INDEXES.platforms,
  theme: SEARCH_INDEXES.themes,
};

@injectable()
export class MeilisearchSearchWriter implements ISearchIndexWriter {
  readonly enabled: boolean;

  constructor(
    @inject(SEARCH_CLIENT) private readonly client: ISearchClient,
    @inject(MEILISEARCH_CONFIG) config: MeilisearchConfig,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository
  ) {
    this.enabled = config.enabled;
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
      await this.upsertDocument(SEARCH_INDEXES.games, toGameDoc(game));
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
      await this.upsertDocument(SEARCH_INDEXES.posts, toPostDoc(post));
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
    if (options.throwOnError && !this.enabled) throw new Error("Meilisearch must be configured for popularity search synchronization");
    await this.bulkIndex(SEARCH_INDEXES.games, ids, (sliceIds) => this.gamesRepo.findByIds(sliceIds), toGameDoc, options.throwOnError);
  }

  async indexLookups(kind: LookupEntity, ids: string[]): Promise<void> {
    await this.bulkIndex(LOOKUP_INDEXES[kind], ids, (sliceIds) => this.gamesRepo.findLookupsByIds(kind, sliceIds), (row) =>
      this.toLookupDoc(kind, row)
    );
  }

  /** Loads and imports the rows one slice at a time: a bulk import costs a few round trips, not one per row. */
  private async bulkIndex<T extends { id: string }>(
    index: string,
    ids: string[],
    load: (ids: string[]) => Promise<T[]>,
    toDoc: (row: T) => object,
    throwOnError = false
  ): Promise<void> {
    if (!this.enabled || ids.length === 0) return;
    try {
      if (!(await this.indexReady(index))) {
        if (throwOnError) throw new Error(`Search index ${index} does not exist yet`);
        return;
      }
    } catch (err) {
      reportRuntimeFailure("search_bulk_index_failed", `Could not bulk index ${index}`, err);
      if (throwOnError) throw err;
      return;
    }
    for (let i = 0; i < ids.length; i += BULK_INDEX_SIZE) {
      const sliceIds = ids.slice(i, i + BULK_INDEX_SIZE);
      try {
        const rows = await load(sliceIds);
        await this.bulkImportDocs(index, rows.map(toDoc), throwOnError);
      } catch (err) {
        reportRuntimeFailure("search_bulk_index_failed", `Could not bulk index ${index}`, err);
        if (throwOnError) throw err;
      }
    }
  }

  private async upsertLookup(entityName: LookupEntity, id: string, row: LookupRow): Promise<void> {
    try {
      await this.upsertDocument(LOOKUP_INDEXES[entityName], this.toLookupDoc(entityName, row));
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
    await this.removeDocument(SEARCH_INDEXES.games, id);
  }

  async removePost(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_INDEXES.posts, id);
  }

  async removeDeveloper(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_INDEXES.developers, id);
  }

  async removePublisher(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_INDEXES.publishers, id);
  }

  async removeGenre(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_INDEXES.genres, id);
  }

  async removePlatform(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_INDEXES.platforms, id);
  }

  async removeTheme(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDocument(SEARCH_INDEXES.themes, id);
  }

  private async removeDocument(index: string, id: string): Promise<void> {
    try {
      // Enqueued only: a missing index or document fails the task without creating anything.
      await this.client.deleteDocument(index, id);
    } catch (err) {
      reportRuntimeFailure("search_delete_failed", `Could not delete a document from ${index}`, err);
    }
  }

  // --- Private: write helpers ---

  /**
   * `false` (with a warning) when the index does not exist yet: the worker owns
   * index creation and settings, and a document write would otherwise create
   * the index with default settings.
   */
  private async indexReady(index: string): Promise<boolean> {
    if (await this.client.indexExists(index)) return true;
    reportRuntimeFailure("search_index_missing", `Search index ${index} does not exist yet. Skipping the write`, undefined, "warning");
    return false;
  }

  /** Adds or fully replaces one document. Resolves once Meilisearch has enqueued the write. */
  private async upsertDocument(index: string, doc: object): Promise<void> {
    if (!(await this.indexReady(index))) return;
    await this.client.addDocuments(index, [doc]);
  }

  /**
   * Enqueues one batch. With `throwOnError` the call waits for the task, since
   * Meilisearch validates documents asynchronously and rejects the whole batch
   * on any invalid document.
   */
  private async bulkImportDocs(index: string, docs: object[], throwOnError = false): Promise<void> {
    if (docs.length === 0) return;
    try {
      const enqueued = await this.client.addDocuments(index, docs);
      if (!throwOnError) return;
      const task = await this.client.waitForTask(enqueued.taskUid);
      if (task.status !== "succeeded") {
        throw new MeilisearchError(
          task.error?.message ?? `Meilisearch task ${task.taskUid} ended as ${task.status}`,
          { code: task.error?.code ?? `task_${task.status}`, type: task.error?.type }
        );
      }
    } catch (err) {
      reportRuntimeFailure("search_bulk_import_failed", `Could not import documents into ${index}`, err);
      if (throwOnError) throw err;
    }
  }
}
