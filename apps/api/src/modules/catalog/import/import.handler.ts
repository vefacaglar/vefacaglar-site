import { inject, injectable } from "tsyringe";
import { GameCatalogService } from "../catalog.service";
import type { GameWithRelations } from "../games.repository.interface";
import type { UpdateGameData } from "../games.service";
import { NotFoundError } from "../../../shared/http-errors";
import { HLTB_CLIENT, IGDB_CLIENT } from "./import.tokens";
import {
  normalizeTitle,
  type IHltbClient,
  type IIgdbClient,
  type ImportedGame,
  type ImportedLookup,
  type ImportedTimes,
} from "./import.types";

export type ImportOptions = { dryRun?: boolean; skipHltb?: boolean };

export type ImportStatus = "created" | "updated" | "skipped" | "not_found" | "failed";

export type ImportResult = {
  query: string;
  status: ImportStatus;
  title?: string;
  slug?: string;
  /** Human-readable notes: filled fields, HLTB misses, errors. */
  notes: string[];
};

type LookupKind = "developer" | "publisher" | "genre" | "platform" | "theme";

/**
 * Imports one game by name: looks it up on IGDB, adds HLTB completion times,
 * then creates it in the catalog or fills the fields an existing record is
 * missing. Existing values are never overwritten.
 */
@injectable()
export class ImportGameHandler {
  /** Per-run cache of lookup slug -> id, so repeated genres/platforms hit the DB once. */
  private readonly lookupIds = new Map<string, string>();

  constructor(
    private readonly catalog: GameCatalogService,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    @inject(HLTB_CLIENT) private readonly hltb: IHltbClient
  ) {}

  /** Imports a game by name, searching IGDB for it first. */
  async handle(query: string, options: ImportOptions = {}): Promise<ImportResult> {
    let source: ImportedGame | null;
    try {
      source = await this.igdb.findGame(query);
    } catch (err) {
      return { query, status: "failed", notes: [err instanceof Error ? err.message : String(err)] };
    }
    if (!source) return { query, status: "not_found", notes: ["not found on IGDB"] };
    return this.importSource(source, options, query);
  }

  /** Imports a game record already fetched from IGDB (used by the full-catalog crawl). */
  async importSource(source: ImportedGame, options: ImportOptions = {}, query = source.title): Promise<ImportResult> {
    const notes: string[] = [];
    try {
      const times = options.skipHltb ? null : await this.fetchTimes(source.title, notes);
      const existing = await this.findExisting(source);

      if (existing) {
        return await this.fillExisting(query, existing, source, times, notes, options);
      }

      if (!options.dryRun) {
        await this.catalog.createGame(
          {
            title: source.title,
            slug: source.slug,
            description: source.description,
            coverImageUrl: source.coverImageUrl,
            releaseDate: source.releaseDate,
            hltbMainHours: times?.mainHours,
            hltbMainExtraHours: times?.mainExtraHours,
            hltbCompletionistHours: times?.completionistHours,
          },
          {
            developerIds: await this.resolveLookups("developer", source.developers),
            publisherIds: await this.resolveLookups("publisher", source.publishers),
            genreIds: await this.resolveLookups("genre", source.genres),
            platformIds: await this.resolveLookups("platform", source.platforms),
            themeIds: await this.resolveLookups("theme", source.themes),
          }
        );
      }
      return { query, status: "created", title: source.title, slug: source.slug, notes };
    } catch (err) {
      notes.push(err instanceof Error ? err.message : String(err));
      return { query, status: "failed", notes };
    }
  }

  private async fillExisting(
    query: string,
    existing: GameWithRelations,
    source: ImportedGame,
    times: ImportedTimes | null,
    notes: string[],
    options: ImportOptions
  ): Promise<ImportResult> {
    const patch: UpdateGameData = {};
    if (!existing.description && source.description) patch.description = source.description;
    if (!existing.coverImageUrl && source.coverImageUrl) patch.coverImageUrl = source.coverImageUrl;
    if (!existing.releaseDate && source.releaseDate) patch.releaseDate = source.releaseDate;
    if (!existing.hltbMainHours && times?.mainHours) patch.hltbMainHours = times.mainHours;
    if (!existing.hltbMainExtraHours && times?.mainExtraHours) patch.hltbMainExtraHours = times.mainExtraHours;
    if (!existing.hltbCompletionistHours && times?.completionistHours) {
      patch.hltbCompletionistHours = times.completionistHours;
    }

    // Relations are only filled when the game has none of that kind, so a
    // hand-curated genre list is never mixed with IGDB's.
    const relationGaps: [LookupKind, ImportedLookup[]][] = (
      [
        ["developer", existing.developers.length === 0 ? source.developers : []],
        ["publisher", existing.publishers.length === 0 ? source.publishers : []],
        ["genre", existing.genres.length === 0 ? source.genres : []],
        ["platform", existing.platforms.length === 0 ? source.platforms : []],
        ["theme", existing.themes.length === 0 ? source.themes : []],
      ] as [LookupKind, ImportedLookup[]][]
    ).filter(([, items]) => items.length > 0);

    const filled = [...Object.keys(patch), ...relationGaps.map(([kind]) => `${kind}s`)];
    const base = { query, title: existing.title, slug: existing.slug };
    if (filled.length === 0) return { ...base, status: "skipped", notes: [...notes, "nothing missing"] };

    if (!options.dryRun) {
      if (Object.keys(patch).length > 0) await this.catalog.updateGame(existing.id, patch);
      for (const [kind, items] of relationGaps) {
        for (const id of await this.resolveLookups(kind, items)) {
          await this.link(kind, existing.id, id);
        }
      }
    }
    return { ...base, status: "updated", notes: [...notes, `filled: ${filled.join(", ")}`] };
  }

  private async fetchTimes(title: string, notes: string[]): Promise<ImportedTimes | null> {
    try {
      const times = await this.hltb.findTimes(title);
      if (!times) notes.push("no exact HLTB match");
      return times;
    } catch (err) {
      // HLTB is best-effort: a broken scraper must not block the IGDB import.
      notes.push(`HLTB error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async findExisting(source: ImportedGame): Promise<GameWithRelations | null> {
    const bySlug = await this.orNull(() => this.catalog.getGameBySlug(source.slug));
    if (bySlug) return bySlug;

    // Hand-entered games may use a different slug; fall back to a title match.
    const wanted = normalizeTitle(source.title);
    const { items } = await this.catalog.listGames({ q: source.title, limit: 20 });
    return (
      items.find(
        (g) => normalizeTitle(g.title) === wanted || (g.originalTitle && normalizeTitle(g.originalTitle) === wanted)
      ) ?? null
    );
  }

  private async resolveLookups(kind: LookupKind, items: ImportedLookup[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      const key = `${kind}:${item.slug}`;
      let id = this.lookupIds.get(key);
      if (!id) {
        const found = await this.orNull(() => this.getLookup(kind, item.slug));
        id = found ? found.id : (await this.createLookup(kind, item)).id;
        this.lookupIds.set(key, id);
      }
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  private getLookup(kind: LookupKind, slug: string): Promise<{ id: string }> {
    switch (kind) {
      case "developer": return this.catalog.getDeveloperBySlug(slug);
      case "publisher": return this.catalog.getPublisherBySlug(slug);
      case "genre": return this.catalog.getGenreBySlug(slug);
      case "platform": return this.catalog.getPlatformBySlug(slug);
      case "theme": return this.catalog.getThemeBySlug(slug);
    }
  }

  private createLookup(kind: LookupKind, item: ImportedLookup): Promise<{ id: string }> {
    switch (kind) {
      case "developer": return this.catalog.createDeveloper(item);
      case "publisher": return this.catalog.createPublisher(item);
      case "genre": return this.catalog.createGenre(item);
      case "platform": return this.catalog.createPlatform(item);
      case "theme": return this.catalog.createTheme(item);
    }
  }

  private link(kind: LookupKind, gameId: string, id: string): Promise<void> {
    switch (kind) {
      case "developer": return this.catalog.linkGameDeveloper(gameId, id);
      case "publisher": return this.catalog.linkGamePublisher(gameId, id);
      case "genre": return this.catalog.linkGameGenre(gameId, id);
      case "platform": return this.catalog.linkGamePlatform(gameId, id);
      case "theme": return this.catalog.linkGameTheme(gameId, id);
    }
  }

  private async orNull<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }
}
