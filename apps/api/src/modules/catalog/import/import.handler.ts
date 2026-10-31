import { inject, injectable } from "tsyringe";
import { GameCatalogService } from "../catalog.service";
import { GAMES_REPOSITORY } from "../catalog.tokens";
import type { GameIdentity, GameWithRelations, IGamesRepository } from "../games.repository.interface";
import type { UpdateGameData } from "../games.service";
import { BadRequestError, NotFoundError } from "../../../shared/http-errors";
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

type TitleMatch = { id: string; year: string | null };
type GameIndex = { bySlug: Map<string, string>; byTitle: Map<string, TitleMatch[]> };

/**
 * Imports one game by name: looks it up on IGDB, adds HLTB completion times,
 * then creates it in the catalog or fills the fields an existing record is
 * missing. Existing values are never overwritten.
 */
@injectable()
export class ImportGameHandler {
  /**
   * In-memory copy of the catalog's identifying columns, loaded once per run so
   * the existence checks never hit the database. Kept current as games and
   * lookups are created.
   */
  private gameIndex: GameIndex | null = null;
  /** Lookup "kind:slug" -> id. */
  private readonly lookupIds = new Map<string, string>();

  constructor(
    private readonly catalog: GameCatalogService,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
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
        const created = await this.catalog.createGame(
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
        this.indexGame(await this.loadIndex(), created);
      }
      return { query, status: "created", title: source.title, slug: source.slug, notes: [...notes, describe(source, times)] };
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
    const index = await this.loadIndex();
    // Hand-entered games may use a different slug, so fall back to a title match.
    // Different games share titles (Doom 1993 vs Doom 2016), so the release
    // year must agree too when both sides have one.
    const year = source.releaseDate?.slice(0, 4) ?? null;
    const id =
      index.bySlug.get(source.slug) ??
      index.byTitle.get(normalizeTitle(source.title))?.find((m) => !m.year || !year || m.year === year)?.id;
    return id ? this.orNull(() => this.catalog.getGameById(id)) : null;
  }

  private async loadIndex(): Promise<GameIndex> {
    if (this.gameIndex) return this.gameIndex;

    const catalog = await this.gamesRepo.loadCatalogIndex();
    const index: GameIndex = { bySlug: new Map(), byTitle: new Map() };
    for (const game of catalog.games) this.indexGame(index, game);
    const lookups: [LookupKind, { id: string; slug: string }[]][] = [
      ["developer", catalog.developers],
      ["publisher", catalog.publishers],
      ["genre", catalog.genres],
      ["platform", catalog.platforms],
      ["theme", catalog.themes],
    ];
    for (const [kind, rows] of lookups) {
      for (const row of rows) this.lookupIds.set(`${kind}:${row.slug}`, row.id);
    }
    this.gameIndex = index;
    return index;
  }

  private indexGame(index: GameIndex, game: GameIdentity): void {
    index.bySlug.set(game.slug, game.id);
    const match: TitleMatch = { id: game.id, year: game.releaseDate?.slice(0, 4) ?? null };
    for (const title of new Set([game.title, game.originalTitle].filter(Boolean).map((t) => normalizeTitle(t!)))) {
      const matches = index.byTitle.get(title);
      if (matches) matches.push(match);
      else index.byTitle.set(title, [match]);
    }
  }

  private async resolveLookups(kind: LookupKind, items: ImportedLookup[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      const key = `${kind}:${item.slug}`;
      let id = this.lookupIds.get(key);
      if (!id) {
        id = (await this.createOrGetLookup(kind, item)).id;
        this.lookupIds.set(key, id);
      }
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  /** The index says the lookup is new; if it was added since (e.g. from the dashboard), fetch it instead. */
  private async createOrGetLookup(kind: LookupKind, item: ImportedLookup): Promise<{ id: string }> {
    try {
      return await this.createLookup(kind, item);
    } catch (err) {
      if (err instanceof BadRequestError) return this.getLookup(kind, item.slug);
      throw err;
    }
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

/** One-line summary of what an import brings in, e.g. "genres: RPG; platforms: PC, Mac; ...". */
function describe(source: ImportedGame, times: ImportedTimes | null): string {
  const names = (items: ImportedLookup[]) => items.map((i) => i.name).join(", ") || "-";
  const parts = [
    `released: ${source.releaseDate ?? "-"}`,
    `genres: ${names(source.genres)}`,
    `themes: ${names(source.themes)}`,
    `platforms: ${names(source.platforms)}`,
    `developers: ${names(source.developers)}`,
    `publishers: ${names(source.publishers)}`,
    `cover: ${source.coverImageUrl ? "yes" : "no"}`,
  ];
  if (times) parts.push(`hltb: ${times.mainHours ?? "-"}/${times.mainExtraHours ?? "-"}/${times.completionistHours ?? "-"}h`);
  return parts.join("; ");
}
