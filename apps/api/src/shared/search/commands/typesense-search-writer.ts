import { inject, injectable } from "tsyringe";
import { Client as TypesenseClient } from "typesense";
import type { Developer } from "../../../modules/games/developers.repository.interface";
import type { Publisher } from "../../../modules/games/publishers.repository.interface";
import type { Genre } from "../../../modules/games/genres.repository.interface";
import type { Platform } from "../../../modules/games/platforms.repository.interface";
import type { Theme } from "../../../modules/games/themes.repository.interface";
import type { GameWithRelations } from "../../../modules/games/games.repository.interface";
import {
  DEVELOPERS_REPOSITORY,
  PUBLISHERS_REPOSITORY,
  GENRES_REPOSITORY,
  PLATFORMS_REPOSITORY,
  THEMES_REPOSITORY,
  GAMES_REPOSITORY,
} from "../../../modules/games/games.tokens";
import type { IDevelopersRepository } from "../../../modules/games/developers.repository.interface";
import type { IPublishersRepository } from "../../../modules/games/publishers.repository.interface";
import type { IGenresRepository } from "../../../modules/games/genres.repository.interface";
import type { IPlatformsRepository } from "../../../modules/games/platforms.repository.interface";
import type { IThemesRepository } from "../../../modules/games/themes.repository.interface";
import type { IGamesRepository } from "../../../modules/games/games.repository.interface";
import { LOCALIZATIONS_REPOSITORY } from "../../../modules/localizations/localizations.tokens";
import type { ILocalizationsRepository } from "../../../modules/localizations/localizations.repository.interface";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, type TypesenseConfig } from "../search.tokens";
import { buildAllCollectionSchemas } from "../collections";
import type { ISearchIndexWriter } from "./search-writer.interface";
import type { SearchLanguage } from "../search.types";
import { toGameDoc } from "../mappers/game.mapper";
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

type LookupEntity = "developer" | "publisher" | "genre" | "platform" | "theme";
type LookupRow = Developer | Publisher | Genre | Platform | Theme;
type LookupDoc = DeveloperDoc | PublisherDoc | GenreDoc | PlatformDoc | ThemeDoc;

/**
 * Command side: keeps the Typesense index in sync with the write model. Indexes
 * every configured language (translations are read from the localizations table
 * for non-base languages). All operations are best-effort: failures are logged,
 * never thrown, so they cannot break the command that triggered them.
 */
@injectable()
export class TypesenseSearchWriter implements ISearchIndexWriter {
  readonly enabled: boolean;
  private readonly languages: SearchLanguage[];
  private readonly baseLanguage: SearchLanguage;

  constructor(
    @inject(TYPESENSE_CLIENT) private readonly typesense: TypesenseClient,
    @inject(TYPESENSE_CONFIG) typesenseConfig: TypesenseConfig,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(LOCALIZATIONS_REPOSITORY) private readonly localizationsRepo: ILocalizationsRepository
  ) {
    this.enabled = typesenseConfig.enabled;
    this.languages = typesenseConfig.languages;
    this.baseLanguage = typesenseConfig.languages[0] ?? "en";
  }

  private needsTranslations(lang: SearchLanguage): boolean {
    return this.languages.length > 1 && lang !== this.baseLanguage;
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
}
