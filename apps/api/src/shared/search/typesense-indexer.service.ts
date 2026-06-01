import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import type { Developer } from "../../modules/games/developers.repository.interface";
import type { Publisher } from "../../modules/games/publishers.repository.interface";
import type { Genre } from "../../modules/games/genres.repository.interface";
import type { Platform } from "../../modules/games/platforms.repository.interface";
import type { Theme } from "../../modules/games/themes.repository.interface";
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
import { buildAllCollectionSchemas } from "./collections";
import {
  type ISearchIndexer,
  type SearchQuery,
  type SearchResult,
  type SearchLanguage,
} from "./search-indexer.interface";
import { LanguageProvider } from "../localization";
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
  private readonly languages: SearchLanguage[];
  private readonly baseLanguage: SearchLanguage;
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
    @inject(LOCALIZATIONS_REPOSITORY) private readonly localizationsRepo: ILocalizationsRepository,
    private readonly languageProvider: LanguageProvider
  ) {
    this.enabled = typesenseConfig.enabled;
    this.languages = typesenseConfig.languages;
    this.baseLanguage = typesenseConfig.languages[0] ?? "en";
    this.breaker = new RedisCircuitBreaker(redis);
  }

  // --- Public search methods (lang comes from AsyncLocalStorage via LanguageProvider) ---

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

  private getLang(): SearchLanguage {
    const raw = this.languageProvider.getLanguage();
    return (this.languages as readonly string[]).includes(raw) ? (raw as SearchLanguage) : this.baseLanguage;
  }

  private needsTranslations(lang: SearchLanguage): boolean {
    return this.languages.length > 1 && lang !== this.baseLanguage;
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

  // --- Public index methods (iterate configured languages; skip translations for base) ---

  async indexGame(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const game = await this.gamesRepo.findById(id);
      if (!game) {
        await this.removeGame(id);
        return;
      }
      for (const lang of this.languages) {
        const translations = this.needsTranslations(lang)
          ? await this.localizationsRepo.findByEntity("game", id, lang)
          : [];
        const doc = toGameDoc(game, lang, translations);
        try {
          await this.typesense.collections(`games_${lang}`).documents().upsert(doc);
        } catch (err) {
          console.error(`[search] failed to upsert game ${id} (${lang}):`, (err as Error).message);
        }
      }
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
      await this.upsertLookupInAllLanguages("developer", id, dev);
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
      await this.upsertLookupInAllLanguages("publisher", id, pub);
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
      await this.upsertLookupInAllLanguages("genre", id, genre);
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
      await this.upsertLookupInAllLanguages("platform", id, platform);
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
      await this.upsertLookupInAllLanguages("theme", id, theme);
    } catch (err) {
      console.error(`[search] failed to index theme ${id}:`, (err as Error).message);
    }
  }

  private async upsertLookupInAllLanguages(
    entityName: LookupEntity,
    id: string,
    row: LookupRow
  ): Promise<void> {
    for (const lang of this.languages) {
      const translations = this.needsTranslations(lang)
        ? await this.localizationsRepo.findByEntity(entityName, id, lang)
        : [];
      const doc = this.toLookupDoc(entityName, row, lang, translations);
      try {
        await this.typesense.collections(`${entityName}s_${lang}`).documents().upsert(doc);
      } catch (err) {
        console.error(`[search] failed to upsert ${entityName} ${id} (${lang}):`, (err as Error).message);
      }
    }
  }

  private toLookupDoc(
    entityName: LookupEntity,
    row: LookupRow,
    lang: SearchLanguage,
    translations: { field: string; value: string }[]
  ): LookupDoc {
    switch (entityName) {
      case "developer": return toDeveloperDoc(row as Developer, lang, translations);
      case "publisher": return toPublisherDoc(row as Publisher, lang, translations);
      case "genre": return toGenreDoc(row as Genre, lang, translations);
      case "platform": return toPlatformDoc(row as Platform, lang, translations);
      case "theme": return toThemeDoc(row as Theme, lang, translations);
    }
  }

  // --- Public remove methods (remove from all configured languages) ---

  async removeGame(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromAllLanguages("games", id);
  }

  async removeDeveloper(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromAllLanguages("developers", id);
  }

  async removePublisher(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromAllLanguages("publishers", id);
  }

  async removeGenre(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromAllLanguages("genres", id);
  }

  async removePlatform(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromAllLanguages("platforms", id);
  }

  async removeTheme(id: string): Promise<void> {
    if (!this.enabled) return;
    await this.removeFromAllLanguages("themes", id);
  }

  private async removeFromAllLanguages(collectionName: string, id: string): Promise<void> {
    for (const lang of this.languages) {
      try {
        await this.typesense.collections(`${collectionName}_${lang}`).documents(id).delete();
      } catch (err) {
        const status = (err as { httpStatus?: number }).httpStatus;
        if (status === 404) continue;
        console.error(`[search] failed to remove ${collectionName} ${id} (${lang}):`, (err as Error).message);
      }
    }
  }

  // --- Reindex ---

  async reindexAll(options: { drop: boolean }): Promise<void> {
    if (!this.enabled) {
      console.warn("[search] reindex skipped: typesense is not configured");
      return;
    }
    const schemas = buildAllCollectionSchemas(this.languages);
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
    console.log(`[search] collections ready (langs: ${this.languages.join(", ")})`);

    const allGames = await this.fetchAllGames();
    let gameCount = 0;
    for (let i = 0; i < allGames.length; i += IMPORT_BATCH_SIZE) {
      const slice = allGames.slice(i, i + IMPORT_BATCH_SIZE);
      const sliceIds = slice.map((g) => g.id);
      for (const lang of this.languages) {
        const translationsByEntity = this.needsTranslations(lang)
          ? await this.localizationsRepo.findByEntities("game", sliceIds, lang)
          : {};
        const docs = slice.map((game) => toGameDoc(game, lang, translationsByEntity[game.id] ?? []));
        await this.bulkImportDocs(`games_${lang}`, docs);
      }
      gameCount += slice.length;
    }
    console.log(`[search] reindexed ${gameCount} games`);

    for (const builder of this.lookupReindexBuilders()) {
      const allRows = await builder.fetchAll();
      let count = 0;
      for (let i = 0; i < allRows.length; i += IMPORT_BATCH_SIZE) {
        const slice = allRows.slice(i, i + IMPORT_BATCH_SIZE);
        const sliceIds = slice.map((r) => r.id);
        for (const lang of this.languages) {
          const translationsByEntity = this.needsTranslations(lang)
            ? await this.localizationsRepo.findByEntities(builder.entityName, sliceIds, lang)
            : {};
          const docs = slice.map((row) => this.toLookupDoc(builder.entityName, row, lang, translationsByEntity[row.id] ?? []));
          await this.bulkImportDocs(`${builder.entityName}s_${lang}`, docs);
        }
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

  // --- Private: search runners (per current request lang) ---

  private async runGamesSearch(query: SearchQuery): Promise<SearchResult<GameWithRelations>> {
    const lang = this.getLang();
    const res = await this.typesense.collections(`games_${lang}`).documents().search({
      q: query.q?.trim() || "*",
      query_by: "title,originalTitle,description,slug,developerNames,publisherNames,genreNames,platformNames,themeNames",
      page: query.page ?? 1,
      per_page: query.limit ?? 10,
    });
    const hits = (res.hits ?? []) as Array<{ document: GameDoc }>;
    return {
      items: hits.map((h) => gameWithRelationsFromDoc(h.document)),
      total: (res.found as number) ?? 0,
    };
  }

  private async runDevelopersSearch(query: SearchQuery): Promise<SearchResult<Developer>> {
    const lang = this.getLang();
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

  private async runPublishersSearch(query: SearchQuery): Promise<SearchResult<Publisher>> {
    const lang = this.getLang();
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

  private async runGenresSearch(query: SearchQuery): Promise<SearchResult<Genre>> {
    const lang = this.getLang();
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

  private async runPlatformsSearch(query: SearchQuery): Promise<SearchResult<Platform>> {
    const lang = this.getLang();
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

  private async runThemesSearch(query: SearchQuery): Promise<SearchResult<Theme>> {
    const lang = this.getLang();
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

  // --- Private: Postgres fallbacks (lang-agnostic, fall back uses raw DB row) ---

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

  // --- Private: bulk import helper ---

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
    fetchAll: () => Promise<LookupRow[]>;
  }> {
    const pageSize = 1000;
    const fetchRows = async <T>(list: (p: { page?: number; limit?: number }) => Promise<{ items: T[] }>): Promise<T[]> => {
      const { items } = await list({ page: 1, limit: pageSize });
      return items;
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

  private isFallbackEligibleError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    if (msg.includes("timed out")) return true;
    if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("etimedout") || msg.includes("network")) return true;
    if (msg.includes("collection") && msg.includes("not found")) return true;
    const status = (err as { httpStatus?: number }).httpStatus;
    if (typeof status === "number" && status >= 500) return true;
    return false;
  }
}
