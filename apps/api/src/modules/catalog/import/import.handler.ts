import { randomUUID } from "crypto";
import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../catalog.tokens";
import type {
  CatalogImportWrite,
  CatalogLookupKind,
  GameIdentity,
  GameWithRelations,
  IGamesRepository,
  NewGame,
} from "../games.repository.interface";
import { EVENT_BUS } from "../../../shared/events/events.tokens";
import type { IEventBus } from "../../../shared/events/event-bus";
import { gamesImported } from "../catalog.events";
import { HLTB_CLIENT, IGDB_CLIENT } from "./import.tokens";
import {
  normalizeTitle,
  type IHltbClient,
  type IIgdbClient,
  type ImportedGame,
  type ImportedLookup,
  type ImportedTimes,
} from "./import.types";

export type ImportOptions = {
  dryRun?: boolean;
  skipHltb?: boolean;
  /** Pause between HLTB lookups within a page, to keep the scraper polite. */
  hltbDelayMs?: number;
};

export type ImportStatus = "created" | "updated" | "skipped" | "not_found" | "failed";

export type ImportResult = {
  query: string;
  status: ImportStatus;
  title?: string;
  slug?: string;
  /** Human-readable notes: filled fields, HLTB misses, errors. */
  notes: string[];
};

type TitleMatch = { id: string; year: string | null };
type GameIndex = {
  byIgdbId: Map<number, string>;
  bySlug: Map<string, string>;
  byTitle: Map<string, TitleMatch[]>;
};

const LOOKUP_KINDS: CatalogLookupKind[] = ["developer", "publisher", "genre", "platform", "theme"];
const LOOKUP_FIELDS = {
  developer: "developers",
  publisher: "publishers",
  genre: "genres",
  platform: "platforms",
  theme: "themes",
} as const;

// Column limits from the games schema. IGDB occasionally exceeds them, and one
// oversized value must not fail the whole page's transaction.
const TITLE_MAX = 250;
const SLUG_MAX = 180;
const LOOKUP_MAX = 120;

/**
 * Imports games from IGDB: adds HLTB completion times, then creates each game
 * in the catalog or fills the fields an existing record is missing. Existing
 * values are never overwritten. A page of games is written in one transaction
 * and indexed for search in one batch.
 */
@injectable()
export class ImportGameHandler {
  /**
   * In-memory copy of the catalog's identifying columns, loaded once per run so
   * the existence checks never hit the database. Kept current as games are created.
   */
  private gameIndex: GameIndex | null = null;

  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    @inject(HLTB_CLIENT) private readonly hltb: IHltbClient,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  /** Imports a game by name, searching IGDB for it first. */
  async handle(query: string, options: ImportOptions = {}): Promise<ImportResult> {
    let source: ImportedGame | null;
    try {
      source = await this.igdb.findGame(query);
    } catch (err) {
      return { query, status: "failed", notes: [message(err)] };
    }
    if (!source) return { query, status: "not_found", notes: ["not found on IGDB"] };

    try {
      const [result] = await this.importPage([source], options);
      return { ...result, query };
    } catch (err) {
      return { query, status: "failed", notes: [message(err)] };
    }
  }

  /**
   * Imports a page of IGDB records with one bulk write. Throws when the write
   * fails, so a crawl can stop and retry the same page on its next run.
   */
  async importPage(sources: ImportedGame[], options: ImportOptions = {}): Promise<ImportResult[]> {
    const index = await this.loadIndex();
    const matches = sources.map((source) => ({ source, existingId: this.findExistingId(index, source) }));
    const existingIds = [...new Set(matches.flatMap((m) => (m.existingId ? [m.existingId] : [])))];
    const existing = new Map((await this.gamesRepo.findByIds(existingIds)).map((g) => [g.id, g]));

    const write: CatalogImportWrite = {
      lookups: byLookupKind(() => []),
      newGames: [],
      gameUpdates: [],
      links: byLookupKind(() => []),
    };
    const results: ImportResult[] = [];
    const newGameResults = new Map<string, ImportResult>();
    const changedGameIds: string[] = [];
    // Games this page already created or filled; a second IGDB record matching one is a duplicate.
    const claimed = new Set<string>();

    for (const [i, { source }] of matches.entries()) {
      // Matched again here: the index now also holds games created earlier in this page.
      const existingId = this.findExistingId(index, source);
      const notes: string[] = [];
      if (!options.skipHltb && i > 0 && options.hltbDelayMs) await sleep(options.hltbDelayMs);
      const times = options.skipHltb ? null : await this.fetchTimes(source.title, notes);
      const base = { query: source.title, title: source.title, slug: source.slug };

      if (existingId && claimed.has(existingId)) {
        results.push({ ...base, status: "skipped", notes: [...notes, "duplicate of a game earlier in this page"] });
        continue;
      }

      const game = existingId ? existing.get(existingId) : undefined;
      if (game) {
        claimed.add(game.id);
        const result = this.planFill(write, game, source, times, notes);
        if (result.status === "updated") changedGameIds.push(game.id);
        results.push(result);
        continue;
      }

      const id = randomUUID();
      claimed.add(id);
      this.planCreate(write, id, source, times);
      this.indexGame(index, {
        id,
        slug: source.slug,
        igdbId: source.igdbId,
        title: source.title,
        originalTitle: null,
        releaseDate: source.releaseDate,
      });
      const result: ImportResult = { ...base, status: "created", notes: [...notes, describe(source, times)] };
      newGameResults.set(id, result);
      results.push(result);
    }

    if (options.dryRun) return results;

    const outcome = await this.gamesRepo.writeImportPage(write);
    const inserted = new Set(outcome.insertedGameIds);
    for (const [id, result] of newGameResults) {
      if (inserted.has(id)) continue;
      result.status = "skipped";
      result.notes = ["slug or IGDB id was taken by another game meanwhile"];
    }

    await this.eventBus.publish(
      gamesImported(
        [...outcome.insertedGameIds, ...changedGameIds],
        byLookupKind((kind) => outcome.lookups[kind].filter((l) => l.created).map((l) => l.id))
      )
    );
    return results;
  }

  private planCreate(write: CatalogImportWrite, id: string, source: ImportedGame, times: ImportedTimes | null): void {
    write.newGames.push({
      id,
      igdbId: source.igdbId,
      title: source.title.slice(0, TITLE_MAX),
      slug: source.slug.slice(0, SLUG_MAX),
      description: source.description,
      coverImageUrl: source.coverImageUrl,
      releaseDate: source.releaseDate,
      criticScore: source.criticScore,
      criticScoreCount: source.criticScoreCount,
      hltbMainHours: toDecimal(times?.mainHours),
      hltbMainExtraHours: toDecimal(times?.mainExtraHours),
      hltbCompletionistHours: toDecimal(times?.completionistHours),
    });
    for (const kind of LOOKUP_KINDS) this.planLinks(write, kind, id, source[LOOKUP_FIELDS[kind]]);
  }

  private planFill(
    write: CatalogImportWrite,
    existing: GameWithRelations,
    source: ImportedGame,
    times: ImportedTimes | null,
    notes: string[]
  ): ImportResult {
    const patch: Partial<NewGame> = {};
    if (!existing.description && source.description) patch.description = source.description;
    if (!existing.coverImageUrl && source.coverImageUrl) patch.coverImageUrl = source.coverImageUrl;
    if (!existing.releaseDate && source.releaseDate) patch.releaseDate = source.releaseDate;
    if (existing.criticScore == null && source.criticScore != null) {
      patch.criticScore = source.criticScore;
      patch.criticScoreCount = source.criticScoreCount;
    }
    if (!existing.hltbMainHours && times?.mainHours) patch.hltbMainHours = toDecimal(times.mainHours);
    if (!existing.hltbMainExtraHours && times?.mainExtraHours) patch.hltbMainExtraHours = toDecimal(times.mainExtraHours);
    if (!existing.hltbCompletionistHours && times?.completionistHours) {
      patch.hltbCompletionistHours = toDecimal(times.completionistHours);
    }

    // Relations are only filled when the game has none of that kind, so a
    // hand-curated genre list is never mixed with IGDB's.
    const relationGaps = LOOKUP_KINDS.filter(
      (kind) => existing[LOOKUP_FIELDS[kind]].length === 0 && source[LOOKUP_FIELDS[kind]].length > 0
    );
    const filled = [...Object.keys(patch), ...relationGaps.map((kind) => LOOKUP_FIELDS[kind])];

    // Linking the IGDB id is bookkeeping, not a content change, so it never makes a game "updated".
    if (existing.igdbId == null) {
      patch.igdbId = source.igdbId;
      this.gameIndex?.byIgdbId.set(source.igdbId, existing.id);
    }
    if (Object.keys(patch).length > 0) write.gameUpdates.push({ id: existing.id, patch: { ...patch, updatedAt: new Date() } });
    for (const kind of relationGaps) this.planLinks(write, kind, existing.id, source[LOOKUP_FIELDS[kind]]);

    const base = { query: source.title, title: existing.title, slug: existing.slug };
    if (filled.length === 0) return { ...base, status: "skipped", notes: [...notes, "nothing missing"] };
    return { ...base, status: "updated", notes: [...notes, `filled: ${filled.join(", ")}`] };
  }

  private planLinks(write: CatalogImportWrite, kind: CatalogLookupKind, gameId: string, items: ImportedLookup[]): void {
    for (const item of items) {
      const lookup = { name: item.name.slice(0, LOOKUP_MAX), slug: item.slug.slice(0, LOOKUP_MAX) };
      write.lookups[kind].push(lookup);
      write.links[kind].push({ gameId, slug: lookup.slug });
    }
  }

  private async fetchTimes(title: string, notes: string[]): Promise<ImportedTimes | null> {
    try {
      const times = await this.hltb.findTimes(title);
      if (!times) notes.push("no exact HLTB match");
      return times;
    } catch (err) {
      // HLTB is best-effort: a broken scraper must not block the IGDB import.
      notes.push(`HLTB error: ${message(err)}`);
      return null;
    }
  }

  private findExistingId(index: GameIndex, source: ImportedGame): string | undefined {
    // Hand-entered games may use a different slug, so fall back to a title match.
    // Different games share titles (Doom 1993 vs Doom 2016), so the release
    // year must agree too when both sides have one.
    const year = source.releaseDate?.slice(0, 4) ?? null;
    return (
      index.byIgdbId.get(source.igdbId) ??
      index.bySlug.get(source.slug) ??
      index.byTitle.get(normalizeTitle(source.title))?.find((m) => !m.year || !year || m.year === year)?.id
    );
  }

  private async loadIndex(): Promise<GameIndex> {
    if (this.gameIndex) return this.gameIndex;

    const catalog = await this.gamesRepo.loadCatalogIndex();
    const index: GameIndex = { byIgdbId: new Map(), bySlug: new Map(), byTitle: new Map() };
    for (const game of catalog.games) this.indexGame(index, game);
    this.gameIndex = index;
    return index;
  }

  private indexGame(index: GameIndex, game: GameIdentity): void {
    if (game.igdbId != null) index.byIgdbId.set(game.igdbId, game.id);
    index.bySlug.set(game.slug, game.id);
    const match: TitleMatch = { id: game.id, year: game.releaseDate?.slice(0, 4) ?? null };
    for (const title of new Set([game.title, game.originalTitle].filter(Boolean).map((t) => normalizeTitle(t!)))) {
      const matches = index.byTitle.get(title);
      if (matches) matches.push(match);
      else index.byTitle.set(title, [match]);
    }
  }
}

function byLookupKind<T>(make: (kind: CatalogLookupKind) => T): Record<CatalogLookupKind, T> {
  return Object.fromEntries(LOOKUP_KINDS.map((kind) => [kind, make(kind)])) as Record<CatalogLookupKind, T>;
}

function toDecimal(hours: number | null | undefined): string | null {
  return hours ? String(hours) : null;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One-line summary of what an import brings in, e.g. "genres: RPG; platforms: PC, Mac; ...". */
function describe(source: ImportedGame, times: ImportedTimes | null): string {
  const names = (items: ImportedLookup[]) => items.map((i) => i.name).join(", ") || "-";
  const parts = [
    `released: ${source.releaseDate ?? "-"}`,
    `critics: ${source.criticScore ?? "-"}${source.criticScoreCount ? ` (${source.criticScoreCount})` : ""}`,
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
