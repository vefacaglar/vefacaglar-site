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
import { LOCALIZATIONS_REPOSITORY } from "../../modules/localizations/localizations.tokens";
import type { ILocalizationsRepository } from "../../modules/localizations/localizations.repository.interface";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, REDIS_CLIENT, type TypesenseConfig } from "./search.tokens";
import type { Redis as RedisClient } from "ioredis";
import { LANGUAGES, buildAllCollectionSchemas } from "./collections";
import {
  type ISearchIndexer,
  type SearchQuery,
  type SearchResult,
  type SearchLanguage,
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
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(LOCALIZATIONS_REPOSITORY) private readonly localizationsRepo: ILocalizationsRepository
  ) {
    this.enabled = typesenseConfig.enabled;
    this.breaker = new RedisCircuitBreaker(redis);
  }

  // --- Public search methods ---

  async searchGames(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<GameWithRelations>> {
    return this.runSearch(
      () => this.runGamesSearch(query, lang),
      () => this.fallbackGamesSearch(query),
      "games"
    );
  }

  async searchDevelopers(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Developer>> {
    return this.runSearch(
      () => this.runDevelopersSearch(query, lang),
      () => this.fallbackDevelopersSearch(query),
      "developers"
    );
  }

  async searchPublishers(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Publisher>> {
    return this.runSearch(
      () => this.runPublishersSearch(query, lang),
      () => this.fallbackPublishersSearch(query),
      "publishers"
    );
  }

  async searchGenres(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Genre>> {
    return this.runSearch(
      () => this.runGenresSearch(query, lang),
      () => this.fallbackGenresSearch(query),
      "genres"
    );
  }

  async searchPlatforms(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Platform>> {
    return this.runSearch(
      () => this.runPlatformsSearch(query, lang),
      () => this.fallbackPlatformsSearch(query),
      "platforms"
    );
  }

  async searchThemes(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Theme>> {
    return this.runSearch(
      () => this.runThemesSearch(query, lang),
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
      await this.upsertGameDocInBothLanguages(game);
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
      await this.upsertLookupDocInBothLanguages(
        "developer",
        id,
        async (lang) => {
          const translations = await this.localizationsRepo.findByEntity("developer", id, lang);
          return toDeveloperDoc(dev, lang, translations);
        }
      );
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
      await this.upsertLookupDocInBothLanguages(
        "publisher",
        id,
        async (lang) => {
          const translations = await this.localizationsRepo.findByEntity("publisher", id, lang);
          return toPublisherDoc(pub, lang, translations);
        }
      );
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
      await this.upsertLookupDocInBothLanguages(
        "genre",
        id,
        async (lang) => {
          const translations = await this.localizationsRepo.findByEntity("genre", id, lang);
          return toGenreDoc(genre, lang, translations);
        }
      );
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
      await this.upsertLookupDocInBothLanguages(
        "platform",
        id,
        async (lang) => {
          const translations = await this.localizationsRepo.findByEntity("platform", id, lang);
          return toPlatformDoc(platform, lang, translations);
        }
      );
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
      await this.upsertLookupDocInBothLanguages(
        "theme",
        id,
        async (lang) => {
          const translations = await this.localizationsRepo.findByEntity("theme", id, lang);
          return toThemeDoc(theme, lang, translations);
        }
      );
    } catch (err) {
      console.error(`[search] failed to index theme ${id}:`, (err as Error).message);
    }
  }

  // --- Public remove methods ---

  async removeGame(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromBothLanguages("games", id);
  }

  async removeDeveloper(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromBothLanguages("developers", id);
  }

  async removePublisher(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromBothLanguages("publishers", id);
  }

  async removeGenre(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromBothLanguages("genres", id);
  }

  async removePlatform(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromBothLanguages("platforms", id);
  }

  async removeTheme(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromBothLanguages("themes", id);
  }

  // --- Reindex ---

  async reindexAll(options: { drop: boolean }): Promise<void> {
    if (!this.enabled) {
      console.warn("[search] reindex skipped: typesense is not configured");
      return;
    }
    console.log(`[search:reindex] (reindexAll called, drop=${options.drop})`);
    const schemas = buildAllCollectionSchemas();
    console.log(`[search:reindex] creating ${schemas.length} collections...`);
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
          console.log(`[search:reindex]   created ${schema.name}`);
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
    console.log(`[search:reindex] collections done, fetching game ids...`);

    const gameIds = await this.fetchAllGameIds();
    console.log(`[search:reindex] fetched ${gameIds.length} game ids`);
    let gameCount = 0;
    for (let i = 0; i < gameIds.length; i += IMPORT_BATCH_SIZE) {
      const batchStart = Date.now();
      const slice = gameIds.slice(i, i + IMPORT_BATCH_SIZE);
      const perLang: Record<SearchLanguage, GameDoc[]> = { en: [], tr: [] };
      for (const id of slice) {
        const game = await this.gamesRepo.findById(id);
        if (!game) continue;
        for (const lang of LANGUAGES) {
          const translations = await this.localizationsRepo.findByEntity("game", id, lang);
          perLang[lang].push(toGameDoc(game, lang, translations));
        }
      }
      for (const lang of LANGUAGES) {
        await this.bulkImportDocs(`games_${lang}`, perLang[lang]);
      }
      gameCount += slice.length;
      console.log(`[search:reindex]   games batch ${i / IMPORT_BATCH_SIZE + 1}/${Math.ceil(gameIds.length / IMPORT_BATCH_SIZE)} done (+${slice.length}) in ${Date.now() - batchStart}ms`);
    }
    console.log(`[search] reindexed ${gameCount} games`);

    for (const builder of this.lookupReindexBuilders()) {
      console.log(`[search:reindex] reindexing ${builder.entityName}...`);
      const ids = await builder.fetchAll();
      console.log(`[search:reindex]   ${ids.length} ${builder.entityName}s`);
      let count = 0;
      for (let i = 0; i < ids.length; i += IMPORT_BATCH_SIZE) {
        const slice = ids.slice(i, i + IMPORT_BATCH_SIZE);
        const perLang: Record<SearchLanguage, Array<DeveloperDoc | PublisherDoc | GenreDoc | PlatformDoc | ThemeDoc>> = {
          en: [],
          tr: [],
        };
        for (const id of slice) {
          const row = await builder.fetch(id);
          if (!row) continue;
          for (const lang of LANGUAGES) {
            const translations = await this.localizationsRepo.findByEntity(builder.entityName, id, lang);
            perLang[lang].push(await builder.toDoc(row, lang, translations));
          }
        }
        for (const lang of LANGUAGES) {
          await this.bulkImportDocs(`${builder.entityName}s_${lang}`, perLang[lang]);
        }
        count += slice.length;
      }
      console.log(`[search] reindexed ${count} ${builder.entityName}s`);
    }
  }

  // --- Private: search runners (Typesense hits) ---

  private async runGamesSearch(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<GameWithRelations>> {
    if (!this.enabled) throw new Error("typesense not configured");
    const searchParams: Record<string, unknown> = {
      q: query.q?.trim() || "*",
      query_by: "title,originalTitle,description,slug,developerNames,publisherNames,genreNames,platformNames,themeNames",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    };
    const res = await this.typesense.collections(`games_${lang}`).documents().search(searchParams);
    const hits = (res.hits ?? []) as Array<{ document: GameDoc }>;
    return {
      items: hits.map((h) => gameWithRelationsFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runDevelopersSearch(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Developer>> {
    if (!this.enabled) throw new Error("typesense not configured");
    const res = await this.typesense.collections(`developers_${lang}`).documents().search({
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

  private async runPublishersSearch(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Publisher>> {
    if (!this.enabled) throw new Error("typesense not configured");
    const res = await this.typesense.collections(`publishers_${lang}`).documents().search({
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

  private async runGenresSearch(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Genre>> {
    if (!this.enabled) throw new Error("typesense not configured");
    const res = await this.typesense.collections(`genres_${lang}`).documents().search({
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

  private async runPlatformsSearch(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Platform>> {
    if (!this.enabled) throw new Error("typesense not configured");
    const res = await this.typesense.collections(`platforms_${lang}`).documents().search({
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

  private async runThemesSearch(query: SearchQuery, lang: SearchLanguage): Promise<SearchResult<Theme>> {
    if (!this.enabled) throw new Error("typesense not configured");
    const res = await this.typesense.collections(`themes_${lang}`).documents().search({
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

  private async fallbackGamesSearch(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    return this.gamesRepo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
  }

  private async fallbackDevelopersSearch(query: SearchQuery): Promise<SearchResult<Developer>> {
    return this.developersRepo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
  }

  private async fallbackPublishersSearch(query: SearchQuery): Promise<SearchResult<Publisher>> {
    return this.publishersRepo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
  }

  private async fallbackGenresSearch(query: SearchQuery): Promise<SearchResult<Genre>> {
    return this.genresRepo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
  }

  private async fallbackPlatformsSearch(query: SearchQuery): Promise<SearchResult<Platform>> {
    return this.platformsRepo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
  }

  private async fallbackThemesSearch(query: SearchQuery): Promise<SearchResult<Theme>> {
    return this.themesRepo.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
  }

  // --- Private: index helpers ---

  private async upsertGameDocInBothLanguages(game: GameWithRelations): Promise<void> {
    if (!this.enabled) return;
    for (const lang of LANGUAGES) {
      const translations = await this.localizationsRepo.findByEntity("game", game.id, lang);
      const doc = toGameDoc(game, lang, translations);
      try {
        await this.typesense.collections(`games_${lang}`).documents().upsert(doc);
      } catch (err) {
        console.error(`[search] failed to upsert game ${game.id} (${lang}):`, (err as Error).message);
      }
    }
  }

  private async upsertLookupDocInBothLanguages<T extends object>(
    entityName: "developer" | "publisher" | "genre" | "platform" | "theme",
    id: string,
    buildDoc: (lang: SearchLanguage) => Promise<T>
  ): Promise<void> {
    if (!this.enabled) return;
    for (const lang of LANGUAGES) {
      const doc = await buildDoc(lang);
      try {
        await this.typesense.collections(`${entityName}s_${lang}`).documents().upsert(doc);
      } catch (err) {
        console.error(`[search] failed to upsert ${entityName} ${id} (${lang}):`, (err as Error).message);
      }
    }
  }

  private async removeFromBothLanguages(entityName: "games" | "developers" | "publishers" | "genres" | "platforms" | "themes", id: string): Promise<void> {
    if (!this.enabled) return;
    for (const lang of LANGUAGES) {
      try {
        await this.typesense.collections(`${entityName}_${lang}`).documents(id).delete();
      } catch (err) {
        const status = (err as { httpStatus?: number }).httpStatus;
        if (status === 404) continue;
        console.error(`[search] failed to remove ${entityName} ${id} (${lang}):`, (err as Error).message);
      }
    }
  }

  private async bulkImportDocs(collectionName: string, docs: object[]): Promise<void> {
    if (!this.enabled) return;
    if (docs.length === 0) return;
    try {
      await this.typesense.collections(collectionName).documents().import(docs, { action: "upsert" });
    } catch (err) {
      console.error(`[search] bulk import ${collectionName} failed:`, (err as Error).message);
    }
  }

  // --- Private: reindex helpers ---

  private async fetchAllGameIds(): Promise<string[]> {
    const pageSize = 1000;
    let page = 1;
    const ids: string[] = [];
    while (true) {
      const { items } = await this.gamesRepo.list({ page, limit: pageSize });
      for (const g of items) ids.push(g.id);
      if (items.length < pageSize) break;
      page++;
      if (page > 100) break; // safety
    }
    return ids;
  }

  private *lookupReindexBuilders(): Generator<{
    entityName: "developer" | "publisher" | "genre" | "platform" | "theme";
    fetchAll: () => Promise<string[]>;
    fetch: (id: string) => Promise<Developer | Publisher | Genre | Platform | Theme | null>;
    toDoc: (
      row: Developer | Publisher | Genre | Platform | Theme,
      lang: SearchLanguage,
      translations: { field: string; value: string }[]
    ) => Promise<DeveloperDoc | PublisherDoc | GenreDoc | PlatformDoc | ThemeDoc>;
  }> {
    const pageSize = 1000;
    const fetchIds = async (list: (p: { page?: number; limit?: number }) => Promise<{ items: Array<{ id: string }> }>): Promise<string[]> => {
      const ids: string[] = [];
      const { items } = await list({ page: 1, limit: pageSize });
      for (const it of items) ids.push(it.id);
      return ids;
    };

    yield {
      entityName: "developer",
      fetchAll: () => fetchIds((p) => this.developersRepo.list(p)),
      fetch: (id) => this.developersRepo.findById(id),
      toDoc: async (row, lang, translations) => toDeveloperDoc(row as Developer, lang, translations),
    };
    yield {
      entityName: "publisher",
      fetchAll: () => fetchIds((p) => this.publishersRepo.list(p)),
      fetch: (id) => this.publishersRepo.findById(id),
      toDoc: async (row, lang, translations) => toPublisherDoc(row as Publisher, lang, translations),
    };
    yield {
      entityName: "genre",
      fetchAll: () => fetchIds((p) => this.genresRepo.list(p)),
      fetch: (id) => this.genresRepo.findById(id),
      toDoc: async (row, lang, translations) => toGenreDoc(row as Genre, lang, translations),
    };
    yield {
      entityName: "platform",
      fetchAll: () => fetchIds((p) => this.platformsRepo.list(p)),
      fetch: (id) => this.platformsRepo.findById(id),
      toDoc: async (row, lang, translations) => toPlatformDoc(row as Platform, lang, translations),
    };
    yield {
      entityName: "theme",
      fetchAll: () => fetchIds((p) => this.themesRepo.list(p)),
      fetch: (id) => this.themesRepo.findById(id),
      toDoc: async (row, lang, translations) => toThemeDoc(row as Theme, lang, translations),
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
