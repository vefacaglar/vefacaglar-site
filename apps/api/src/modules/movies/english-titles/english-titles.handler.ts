import { inject, injectable } from "tsyringe";
import { WIKIDATA_ENTITY_CLIENT } from "../movies.tokens";
import type { EntityLabels, IWikidataEntityClient } from "../import/movie-source.types";
import { MOVIE_ENGLISH_TITLE_REPOSITORY, type EnglishTitleState, type IMovieEnglishTitleRepository } from "./english-titles.types";

const BATCH = 50;
const DAY = 86_400_000;
/** Consecutive provider failures after which the continuation chain stops until the next cron run. */
const MAX_CHAINED_FAILURES = 5;
/** A completed pass is repeated at most this often, to catch later Wikidata label drift. */
export const ENGLISH_TITLE_REPASS_MS = 30 * DAY;

export type EnglishTitleOptions = {
  /** Read-only inspection: no title, state or cooldown writes. */
  dryRun?: boolean;
  /** Dry run only: stop after this many films. */
  limit?: number;
  /** Dry run only: start after this movie id instead of the beginning. */
  after?: string | null;
  budgetMs?: number;
  maxRequests?: number;
  sampleSize?: number;
};
export type EnglishTitleChange = { slug: string; from: string | null; to: string };
export type EnglishTitleResult = {
  mode: "apply" | "dry-run";
  status: "progress" | "pass_complete" | "idle" | "cooldown" | "provider_error";
  scanned: number; englishFound: number; changed: number; unchanged: number; noEnglish: number; errors: number;
  requests: number; cursor: string | null; passScanned: number; passChanged: number;
  hasMore: boolean; progressMade: boolean; nextRunAt: string | null; durationMs: number;
  samples: EnglishTitleChange[];
};

/**
 * Bounded, resumable pass that replaces stored non-English movie titles with the
 * English-reader Wikidata label (same priority as the normalizer). Slugs never change.
 */
@injectable()
export class FixMovieEnglishTitlesHandler {
  constructor(@inject(MOVIE_ENGLISH_TITLE_REPOSITORY) private readonly repo: IMovieEnglishTitleRepository,
    @inject(WIKIDATA_ENTITY_CLIENT) private readonly client: IWikidataEntityClient) {}

  async handle(options: EnglishTitleOptions = {}): Promise<EnglishTitleResult> {
    const started = Date.now();
    const dryRun = options.dryRun === true;
    const budget = dryRun ? Number.POSITIVE_INFINITY : Math.max(1000, Math.min(180_000, options.budgetMs ?? 150_000));
    const maxRequests = dryRun ? Number.POSITIVE_INFINITY : Math.max(1, Math.min(300, options.maxRequests ?? 200));
    const limit = dryRun && options.limit !== undefined ? Math.max(1, Math.trunc(options.limit)) : Number.POSITIVE_INFINITY;
    const sampleSize = Math.max(0, options.sampleSize ?? (dryRun ? 30 : 5));
    const signal = Number.isFinite(budget) ? AbortSignal.timeout(budget) : undefined;
    const result: EnglishTitleResult = { mode: dryRun ? "dry-run" : "apply", status: "progress",
      scanned: 0, englishFound: 0, changed: 0, unchanged: 0, noEnglish: 0, errors: 0, requests: 0,
      cursor: null, passScanned: 0, passChanged: 0, hasMore: false, progressMade: false, nextRunAt: null, durationMs: 0, samples: [] };
    const finish = () => ({ ...result, durationMs: Date.now() - started });

    let state: EnglishTitleState | null = null;
    let cursor: string | null;
    if (dryRun) {
      cursor = options.after ?? null;
    } else {
      state = await this.repo.state();
      const cooldown = await this.repo.wikidataCooldown();
      result.cursor = state.cursor;
      result.passScanned = state.passScanned;
      result.passChanged = state.passChanged;
      if (cooldown && cooldown.getTime() > Date.now()) {
        // A duplicate run during a cooldown never starts a chain; the next cron run resumes.
        result.status = "cooldown";
        result.hasMore = state.cursor !== null;
        result.nextRunAt = cooldown.toISOString();
        return finish();
      }
      if (state.cursor === null) {
        if (state.lastPassCompletedAt && Date.now() - state.lastPassCompletedAt.getTime() < ENGLISH_TITLE_REPASS_MS) {
          result.status = "idle";
          return finish();
        }
        const pass = { passStartedAt: new Date(), passScanned: 0, passChanged: 0 };
        await this.repo.saveState(pass);
        state = { ...state, ...pass };
        result.passScanned = 0;
        result.passChanged = 0;
        result.progressMade = true;
      }
      cursor = state.cursor;
    }

    const room = () => result.requests < maxRequests && Date.now() - started < budget - 5000 && result.scanned < limit;
    let exhausted = false;
    let stopChain = false;
    while (room()) {
      const take = Math.min(BATCH, limit - result.scanned);
      const rows = await this.repo.candidates(cursor, take);
      if (!rows.length) { exhausted = true; break; }
      if (!dryRun) {
        // Another movie job may have hit a provider limit while this chain was running.
        const cooldown = await this.repo.wikidataCooldown();
        if (cooldown && cooldown.getTime() > Date.now()) { result.status = "cooldown"; result.nextRunAt = cooldown.toISOString(); break; }
      }
      result.requests++;
      let labels: EntityLabels;
      try { labels = await this.client.fetchEnglishLabels(rows.map((row) => row.wikidataId), { signal }); }
      catch (error) {
        result.errors++;
        result.status = "provider_error";
        const retry = (error as { retryAfter?: unknown })?.retryAfter;
        const retryAt = retry instanceof Date && Number.isFinite(retry.getTime()) ? retry.getTime() : Date.now() + 60_000;
        const until = new Date(Math.max(Date.now() + 30_000, retryAt));
        result.nextRunAt = until.toISOString();
        if (!dryRun && state) {
          const code = (error as { code?: unknown })?.code;
          await this.repo.recordWikidataCooldown(until);
          await this.repo.saveState({ failureCount: state.failureCount + 1, errorCode: typeof code === "string" ? code : "wikidata_request_failed" });
          result.progressMade = true;
          stopChain = state.failureCount + 1 >= MAX_CHAINED_FAILURES;
        }
        break;
      }
      let changed = 0;
      for (const row of rows) {
        result.scanned++;
        const label = labels[row.wikidataId] ?? null;
        if (label === null) { result.noEnglish++; continue; }
        result.englishFound++;
        if (label === row.title) { result.unchanged++; continue; }
        // Dry runs count what would change; the job compares-and-sets under a row lock.
        if (dryRun || await this.repo.replaceTitle(row.id, row.title, label, new Date())) {
          changed++;
          if (result.samples.length < sampleSize) result.samples.push({ slug: row.slug, from: row.title, to: label });
        } else result.unchanged++;
      }
      result.changed += changed;
      cursor = rows[rows.length - 1].id;
      result.cursor = cursor;
      result.passScanned += rows.length;
      result.passChanged += changed;
      if (!dryRun && state) {
        await this.repo.saveState({ cursor, passScanned: result.passScanned, passChanged: result.passChanged, failureCount: 0, errorCode: null });
        state = { ...state, cursor, failureCount: 0 };
        result.progressMade = true;
      }
      if (rows.length < take) { exhausted = true; break; }
    }

    if (exhausted) {
      result.status = "pass_complete";
      result.cursor = null;
      if (!dryRun) {
        await this.repo.saveState({ cursor: null, lastPassCompletedAt: new Date(), passScanned: result.passScanned, passChanged: result.passChanged });
        result.progressMade = true;
      }
    }
    result.hasMore = !exhausted && !stopChain && (dryRun ? result.scanned < limit : true);
    return finish();
  }
}
