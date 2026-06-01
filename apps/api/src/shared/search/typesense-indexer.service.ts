import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import type { Developer, NewDeveloper } from "../../modules/games/developers.repository.interface";
import type { Publisher, NewPublisher } from "../../modules/games/publishers.repository.interface";
import type { Genre, NewGenre } from "../../modules/games/genres.repository.interface";
import type { Platform, NewPlatform } from "../../modules/games/platforms.repository.interface";
import type { Theme, NewTheme } from "../../modules/games/themes.repository.interface";
import type { GameWithRelations } from "../../modules/games/games.repository.interface";
import { DEVELOPERS_REPOSITORY, PUBLISHERS_REPOSITORY, GENRES_REPOSITORY, PLATFORMS_REPOSITORY, THEMES_REPOSITORY, GAMES_REPOSITORY } from "../../modules/games/games.tokens";
import type { IDevelopersRepository } from "../../modules/games/developers.repository.interface";
import type { IPublishersRepository } from "../../modules/games/publishers.repository.interface";
import type { IGenresRepository } from "../../modules/games/genres.repository.interface";
import type { IPlatformsRepository } from "../../modules/games/platforms.repository.interface";
import type { IThemesRepository } from "../../modules/games/themes.repository.interface";
import type { IGamesRepository } from "../../modules/games/games.repository.interface";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, REDIS_CLIENT, type TypesenseConfig } from "./search.tokens";
import type { Redis as RedisClient } from "ioredis";
import { buildAllCollectionSchemas } from "./collections";
import {
  type ISearchIndexer,
  type SearchQuery,
  type SearchResult,
} from "./search-indexer.interface";
import { RedisCircuitBreaker } from "./circuit-breaker";
import { withTimeout } from "./with-timeout";
import { toGameDoc, gameWithRelationsFromDoc, type GameDoc } from "./mappers/game.mapper";
import {
  toDeveloperDoc,
  toPublisherDoc,
  toGenreDoc,
  toPlatformDoc,
  toThemeDoc,
  developerFromDoc,
  publisherFromDoc,
  genreFromDoc,
  platformFromDoc,
  themeFromDoc,
  type DeveloperDoc,
  type PublisherDoc,
  type GenreDoc,
  type PlatformDoc,
  type ThemeDoc,
} from "./mappers/lookup.mapper";

const SEARCH_TIMEOUT_MS = 3000;
const IMPORT_BATCH_SIZE = 100;

type LookupEntity = "developer" | "publisher" | "genre" | "platform" | "theme";
type LookupRow = Developer | Publisher | Genre | Platform | Theme;
type LookupDoc = DeveloperDoc | PublisherDoc | GenreDoc | PlatformDoc | ThemeDoc;

@injectable()
export class TypesenseSearchIndexer implements ISearchIndexer {
  readonly enabled: boolean;
  private readonly breaker: RedisCircuitBreaker;

  constructor(
    @inject(TYPESENSE_CLIENT) private readonly typesense: TypesenseClient,
    @inject(TYPESENSE_CONFIG) typesenseConfig: TypesenseConfig,
    @inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository
  ) {
    this.enabled = typesenseConfig.enabled;
    this.breaker = new RedisCircuitBreaker(redis);
  }

  // --- Public search methods ---

  searchGames(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    return this.runSearch(
      () => this.runGamesSearch(query),
      () => this.fallbackGamesSearch(query),
      "games"
    );
  }

  searchDevelopers(query: SearchQuery): Promise<SearchResult<Developer>> {
    return this.runSearch(
      () => this.runDevelopersSearch(query),
      () => this.fallbackDevelopersSearch(query),
      "developers"
    );
  }

  searchPublishers(query: SearchQuery): Promise<SearchResult<Publisher>> {
    return this.runSearch(
      () => this.runPublishersSearch(query),
      () => this.fallbackPublishersSearch(query),
      "publishers"
    );
  }

  searchGenres(query: SearchQuery): Promise<SearchResult<Genre>> {
    return this.runSearch(
      () => this.runGenresSearch(query),
      () => this.fallbackGenresSearch(query),
      "genres"
    );
  }

  searchPlatforms(query: SearchQuery): Promise<SearchResult<Platform>> {
    return this.runSearch(
      () => this.runPlatformsSearch(query),
      () => this.fallbackPlatformsSearch(query),
      "platforms"
    );
  }

  searchThemes(query: SearchQuery): Promise<SearchResult<Theme>> {
    return this.runSearch(
      () => this.runThemesSearch(query),
      () => this.fallbackThemesSearch(query),
      "themes"
    );
  }

  private async runSearch<T>(
    typesenseCall: () => Promise<T>,
    fallback: () => Promise<T>,
    entityLabel: string
  ): Promise<T> {
    if (!this.enabled) {
      return fallback();
    }
    const breakerOpen = await this.breaker.isOpen();
    if (breakerOpen) {
      return fallback();
    }
    try {
      const result = await withTimeout(typesenseCall(), SEARCH_TIMEOUT_MS, `typesense.${entityLabel}.search`);
      await this.breaker.recordSuccess();
      return result;
    } catch (err) {
      if (this.isFallbackEligibleError(err)) {
        await this.breaker.recordFailure();
        console.warn(`[search] typesense ${entityLabel} search failed, falling back to postgres: ${(err as Error).message}`);
        return fallback();
      }
      throw err;
    }
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
      const doc = toGameDoc(game);
      await this.typesense.collections("games").documents().upsert(doc);
    } catch (err) {
      console.error(`[search] failed to index game ${id}:`, (err as Error).message);
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
      await this.typesense.collections("developers").documents().upsert(toDeveloperDoc(dev));
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
      await this.typesense.collections("publishers").documents().upsert(toPublisherDoc(pub));
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
      await this.typesense.collections("genres").documents().upsert(toGenreDoc(genre));
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
      await this.typesense.collections("platforms").documents().upsert(toPlatformDoc(platform));
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
      await this.typesense.collections("themes").documents().upsert(toThemeDoc(theme));
    } catch (err) {
      console.error(`[search] failed to index theme ${id}:`, (err as Error).message);
    }
  }

  // --- Public remove methods ---

  async removeGame(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDoc("games", id);
  }

  async removeDeveloper(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDoc("developers", id);
  }

  async removePublisher(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDoc("publishers", id);
  }

  async removeGenre(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDoc("genres", id);
  }

  async removePlatform(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDoc("platforms", id);
  }

  async removeTheme(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeDoc("themes", id);
  }

  // --- Reindex ---

  async reindexAll(options: { drop: boolean }): Promise<void> {
    if (!this.enabled) {
      console.warn("[search] reindex skipped: typesense is not configured");
      return;
    }
    const schemas = buildAllCollectionSchemas();
    for (const schema of schemas) {
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
    console.log(`[search] collections ready`);

    const allGames = await this.fetchAllGames();
    let gameCount = 0;
    for (let i = 0; i < allGames.length; i += IMPORT_BATCH_SIZE) {
      const slice = allGames.slice(i, i + IMPORT_BATCH_SIZE);
      const docs = slice.map(toGameDoc);
      await this.bulkImportDocs("games", docs);
      gameCount += slice.length;
    }
    console.log(`[search] reindexed ${gameCount} games`);

    for (const builder of this.lookupReindexBuilders()) {
      const allRows = await builder.fetchAll();
      let count = 0;
      for (let i = 0; i < allRows.length; i += IMPORT_BATCH_SIZE) {
        const slice = allRows.slice(i, i + IMPORT_BATCH_SIZE);
        const docs: LookupDoc[] = slice.map((row) => builder.toDoc(row));
        await this.bulkImportDocs(builder.collectionName, docs);
        count += slice.length;
      }
      console.log(`[search] reindexed ${count} ${builder.entityName}s`);
    }
  }

  private async fetchAllGames(): Promise<GameWithRelations[]> {
    const pageSize = 500;
    let page = 1;
    const all: GameWithRelations[] = [];
    while (true) {
      const { items } = await this.gamesRepo.list({ page, limit: pageSize });
      for (const g of items) all.push(g);
      if (items.length < pageSize) break;
      page++;
      if (page > 50) break;
    }
    return all;
  }

  // --- Private: search runners (Typesense hits) ---

  private async runGamesSearch(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    const searchParams: Record<string, unknown> = {
      q: query.q?.trim() || "*",
      query_by: "title,originalTitle,description,slug,developerNames,publisherNames,genreNames,platformNames,themeNames",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    };
    const res = await this.typesense.collections("games").documents().search(searchParams);
    const hits = (res.hits ?? []) as Array<{ document: GameDoc }>;
    return {
      items: hits.map((h) => gameWithRelationsFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runDevelopersSearch(query: SearchQuery): Promise<SearchResult<Developer>> {
    const res = await this.typesense.collections("developers").documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: DeveloperDoc }>;
    return {
      items: hits.map((h) => developerFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runPublishersSearch(query: SearchQuery): Promise<SearchResult<Publisher>> {
    const res = await this.typesense.collections("publishers").documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: PublisherDoc }>;
    return {
      items: hits.map((h) => publisherFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runGenresSearch(query: SearchQuery): Promise<SearchResult<Genre>> {
    const res = await this.typesense.collections("genres").documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: GenreDoc }>;
    return {
      items: hits.map((h) => genreFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runPlatformsSearch(query: SearchQuery): Promise<SearchResult<Platform>> {
    const res = await this.typesense.collections("platforms").documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: PlatformDoc }>;
    return {
      items: hits.map((h) => platformFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runThemesSearch(query: SearchQuery): Promise<SearchResult<Theme>> {
    const res = await this.typesense.collections("themes").documents().search({
      q: query.q?.trim() || "*",
      query_by: "name,slug",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: ThemeDoc }>;
    return {
      items: hits.map((h) => themeFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  // --- Private: Postgres fallbacks ---

  private fallbackGamesSearch(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    return this.gamesRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackDevelopersSearch(query: SearchQuery): Promise<SearchResult<Developer>> {
    return this.developersRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackPublishersSearch(query: SearchQuery): Promise<SearchResult<Publisher>> {
    return this.publishersRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackGenresSearch(query: SearchQuery): Promise<SearchResult<Genre>> {
    return this.genresRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackPlatformsSearch(query: SearchQuery): Promise<SearchResult<Platform>> {
    return this.platformsRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  private fallbackThemesSearch(query: SearchQuery): Promise<SearchResult<Theme>> {
    return this.themesRepo.list({ q: query.q, page: query.page, limit: query.limit });
  }

  // --- Private: doc helpers ---

  private async removeDoc(collectionName: string, id: string): Promise<void> {
    try {
      await this.typesense.collections(collectionName).documents(id).delete();
    } catch (err) {
      const status = (err as { httpStatus?: number }).httpStatus;
      if (status === 404) return;
      console.error(`[search] failed to remove ${collectionName} ${id}:`, (err as Error).message);
    }
  }

  private async bulkImportDocs(collectionName: string, docs: object[]): Promise<void> {
    if (docs.length === 0) return;
    try {
      await this.typesense.collections(collectionName).documents().import(docs, { action: "upsert" });
    } catch (err) {
      console.error(`[search] bulk import ${collectionName} failed:`, (err as Error).message);
    }
  }

  private *lookupReindexBuilders(): Generator<{
    entityName: LookupEntity;
    collectionName: string;
    fetchAll: () => Promise<LookupRow[]>;
    toDoc: (row: LookupRow) => LookupDoc;
  }> {
    const pageSize = 1000;
    const fetchRows = async <T>(list: (p: { page?: number; limit?: number }) => Promise<{ items: T[] }>): Promise<T[]> => {
      const { items } = await list({ page: 1, limit: pageSize });
      return items;
    };

    yield {
      entityName: "developer",
      collectionName: "developers",
      fetchAll: () => fetchRows((p) => this.developersRepo.list(p)),
      toDoc: (row) => toDeveloperDoc(row as Developer),
    };
    yield {
      entityName: "publisher",
      collectionName: "publishers",
      fetchAll: () => fetchRows((p) => this.publishersRepo.list(p)),
      toDoc: (row) => toPublisherDoc(row as Publisher),
    };
    yield {
      entityName: "genre",
      collectionName: "genres",
      fetchAll: () => fetchRows((p) => this.genresRepo.list(p)),
      toDoc: (row) => toGenreDoc(row as Genre),
    };
    yield {
      entityName: "platform",
      collectionName: "platforms",
      fetchAll: () => fetchRows((p) => this.platformsRepo.list(p)),
      toDoc: (row) => toPlatformDoc(row as Platform),
    };
    yield {
      entityName: "theme",
      collectionName: "themes",
      fetchAll: () => fetchRows((p) => this.themesRepo.list(p)),
      toDoc: (row) => toThemeDoc(row as Theme),
    };
  }

  private isFallbackEligibleError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    if (msg.includes("timed out")) return true;
    if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("etimedout") || msg.includes("network")) return true;
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number" && status >= 500) return true;
    return false;
  }
}

export type { Developer, NewDeveloper, Publisher, NewPublisher, Genre, NewGenre, Platform, NewPlatform, Theme, NewTheme };
