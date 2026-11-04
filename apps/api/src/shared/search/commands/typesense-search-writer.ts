import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import type { Developer } from "../../../modules/catalog/developers.repository.interface";
import type { Publisher } from "../../../modules/catalog/publishers.repository.interface";
import type { Genre } from "../../../modules/catalog/genres.repository.interface";
import type { Platform } from "../../../modules/catalog/platforms.repository.interface";
import type { Theme } from "../../../modules/catalog/themes.repository.interface";
import type { PostWithAuthor } from "../../../modules/posts/posts.repository";
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
import { buildAllCollectionSchemas, LEGACY_SEARCH_COLLECTIONS, SEARCH_COLLECTIONS } from "../collections";
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

const IMPORT_BATCH_SIZE = 100;
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
      console.error(`[search] failed to index game ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to index post ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to index developer ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to index publisher ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to index genre ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to index platform ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to index theme ${id}:`, (err as Error).message);
    }
  }

  async indexGames(ids: string[]): Promise<void> {
    await this.bulkIndex(SEARCH_COLLECTIONS.games, ids, (sliceIds) => this.gamesRepo.findByIds(sliceIds), toGameDoc);
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
    toDoc: (row: T) => object
  ): Promise<void> {
    if (!this.enabled || ids.length === 0) return;
    for (let i = 0; i < ids.length; i += BULK_INDEX_SIZE) {
      const sliceIds = ids.slice(i, i + BULK_INDEX_SIZE);
      try {
        const rows = await load(sliceIds);
        await this.bulkImportDocs(collection, rows.map(toDoc));
      } catch (err) {
        console.error(`[search] failed to bulk-index ${sliceIds.length} ${collection}:`, (err as Error).message);
      }
    }
  }

  private async upsertLookup(entityName: LookupEntity, id: string, row: LookupRow): Promise<void> {
    try {
      await this.typesense.collections(LOOKUP_COLLECTIONS[entityName]).documents().upsert(this.toLookupDoc(entityName, row));
    } catch (err) {
      console.error(`[search] failed to upsert ${entityName} ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to cascade-reindex games for ${relation} ${id}:`, (err as Error).message);
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
      console.error(`[search] failed to remove ${collectionName} ${id}:`, (err as Error).message);
    }
  }

  // --- Reindex ---

  async reindexAll(options: { drop: boolean }): Promise<void> {
    if (!this.enabled) {
      console.warn("[search] reindex skipped: typesense is not configured");
      return;
    }
    if (options.drop) {
      await this.dropLegacyCollections();
    }
    for (const schema of buildAllCollectionSchemas()) {
      try {
        if (options.drop) {
          try {
            await this.typesense.collections(schema.name).delete();
          } catch {
            // Collection may not exist; ignore.
          }
        }
        try {
          await this.typesense.collections().create(schema);
        } catch (err) {
          const msg = (err as Error).message ?? "";
          if (msg.includes("already exists") || msg.includes("409")) {
            // already exists; ok
          } else {
            throw err;
          }
        }
      } catch (err) {
        console.error(`[search] failed to create collection ${schema.name}:`, (err as Error).message);
      }
    }
    console.log("[search] collections ready");

    // Games are read and imported one page at a time, so a large catalog never sits in memory.
    let gameCount = 0;
    for (let page = 1; ; page++) {
      const { items: slice } = await this.gamesRepo.list({ page, limit: IMPORT_BATCH_SIZE });
      await this.bulkImportDocs(SEARCH_COLLECTIONS.games, slice.map(toGameDoc));
      gameCount += slice.length;
      if (slice.length < IMPORT_BATCH_SIZE) break;
    }
    console.log(`[search] reindexed ${gameCount} games`);

    const allPublishedPosts = await this.fetchAllPublishedPosts();
    let postCount = 0;
    for (let i = 0; i < allPublishedPosts.length; i += IMPORT_BATCH_SIZE) {
      const slice = allPublishedPosts.slice(i, i + IMPORT_BATCH_SIZE);
      await this.bulkImportDocs(SEARCH_COLLECTIONS.posts, slice.map(toPostDoc));
      postCount += slice.length;
    }
    console.log(`[search] reindexed ${postCount} published posts`);

    for (const builder of this.lookupReindexBuilders()) {
      const allRows = await builder.fetchAll();
      let count = 0;
      for (let i = 0; i < allRows.length; i += IMPORT_BATCH_SIZE) {
        const slice = allRows.slice(i, i + IMPORT_BATCH_SIZE);
        const docs = slice.map((row) => this.toLookupDoc(builder.entityName, row));
        await this.bulkImportDocs(LOOKUP_COLLECTIONS[builder.entityName], docs);
        count += slice.length;
      }
      console.log(`[search] reindexed ${count} ${builder.entityName}s`);
    }
  }

  /** Deletes the collections of the removed Turkish index (`games_tr`, …); missing ones are skipped. */
  private async dropLegacyCollections(): Promise<void> {
    for (const name of LEGACY_SEARCH_COLLECTIONS) {
      try {
        await this.typesense.collections(name).delete();
        console.log(`[search] dropped legacy collection ${name}`);
      } catch (err) {
        const status = (err as { httpStatus?: number }).httpStatus;
        if (status === 404) continue;
        console.error(`[search] failed to drop legacy collection ${name}:`, (err as Error).message);
      }
    }
  }

  private async fetchAllPublishedPosts(): Promise<PostWithAuthor[]> {
    const pageSize = 500;
    let page = 1;
    const all: PostWithAuthor[] = [];
    while (true) {
      const { items } = await this.postsRepo.listRawWithAuthor({ status: "published", page, limit: pageSize });
      for (const p of items) all.push(p);
      if (items.length < pageSize) break;
      page++;
      if (page > 50) break;
    }
    return all;
  }

  // --- Private: bulk import helper ---

  private async bulkImportDocs(collectionName: string, docs: object[]): Promise<void> {
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
        console.error(
          `[search] bulk import ${collectionName}: ${failures.length}/${docs.length} documents failed. First error: ${firstError}`
        );
      }
    } catch (err) {
      console.error(`[search] bulk import ${collectionName} failed:`, (err as Error).message);
    }
  }

  private *lookupReindexBuilders(): Generator<{
    entityName: LookupEntity;
    fetchAll: () => Promise<LookupRow[]>;
  }> {
    const pageSize = 1000;
    const fetchRows = async <T>(list: (p: { page?: number; limit?: number }) => Promise<{ items: T[] }>): Promise<T[]> => {
      const all: T[] = [];
      for (let page = 1; ; page++) {
        const { items } = await list({ page, limit: pageSize });
        all.push(...items);
        if (items.length < pageSize) return all;
      }
    };

    yield {
      entityName: "developer",
      fetchAll: () => fetchRows((p) => this.developersRepo.list(p)),
    };
    yield {
      entityName: "publisher",
      fetchAll: () => fetchRows((p) => this.publishersRepo.list(p)),
    };
    yield {
      entityName: "genre",
      fetchAll: () => fetchRows((p) => this.genresRepo.list(p)),
    };
    yield {
      entityName: "platform",
      fetchAll: () => fetchRows((p) => this.platformsRepo.list(p)),
    };
    yield {
      entityName: "theme",
      fetchAll: () => fetchRows((p) => this.themesRepo.list(p)),
    };
  }
}
