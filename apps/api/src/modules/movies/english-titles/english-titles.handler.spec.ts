import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IWikidataEntityClient } from "../import/movie-source.types";
import { MovieSourceError } from "../import/wikidata-entity.client";
import { ENGLISH_TITLE_REPASS_MS, FixMovieEnglishTitlesHandler } from "./english-titles.handler";
import { ENGLISH_TITLE_USAGE, parseEnglishTitleArgs } from "./english-titles.args";
import type { EnglishTitleCandidate, EnglishTitleState, IMovieEnglishTitleRepository } from "./english-titles.types";

const state = (patch: Partial<EnglishTitleState> = {}): EnglishTitleState => ({
  cursor: null, passStartedAt: null, lastPassCompletedAt: null, passScanned: 0, passChanged: 0, failureCount: 0, ...patch,
});
const row = (n: number, title: string | null = `Title ${n}`): EnglishTitleCandidate => ({
  id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`, wikidataId: `Q${n}`, slug: `title-${n}-q${n}`, title,
});
const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));

let repo: Record<keyof IMovieEnglishTitleRepository, any>;
let client: Record<keyof IWikidataEntityClient, any>;
const run = (options = {}) => new FixMovieEnglishTitlesHandler(repo, client).handle(options);
/** Labels equal the stored title unless overridden. */
const labelsFrom = (overrides: Record<string, string | null> = {}) => vi.fn(async (qids: string[]) =>
  Object.fromEntries(qids.map((qid) => [qid, qid in overrides ? overrides[qid] : `Title ${qid.slice(1)}`])));

beforeEach(() => {
  repo = {
    state: vi.fn().mockResolvedValue(state()),
    saveState: vi.fn(),
    wikidataCooldown: vi.fn().mockResolvedValue(null),
    recordWikidataCooldown: vi.fn(),
    candidates: vi.fn().mockResolvedValue([]),
    replaceTitle: vi.fn().mockResolvedValue(true),
  };
  client = { fetchEntities: vi.fn(), fetchLabels: vi.fn(), fetchEnglishLabels: labelsFrom() };
});

describe("FixMovieEnglishTitlesHandler", () => {
  it("replaces only titles whose English label differs, and resumes from the cursor", async () => {
    repo.state.mockResolvedValue(state({ cursor: row(10).id, passScanned: 10, passChanged: 1, passStartedAt: new Date() }));
    repo.candidates.mockResolvedValueOnce([row(11, "无间道风云"), row(12), row(13, "Apocalipse Z")]).mockResolvedValueOnce([]);
    client.fetchEnglishLabels = labelsFrom({ Q11: "The Departed", Q13: null });

    const result = await run();

    expect(repo.candidates).toHaveBeenCalledWith(row(10).id, 50);
    expect(repo.replaceTitle).toHaveBeenCalledTimes(1);
    expect(repo.replaceTitle).toHaveBeenCalledWith(row(11).id, "无间道风云", "The Departed", expect.any(Date));
    expect(result).toMatchObject({ scanned: 3, englishFound: 2, changed: 1, unchanged: 1, noEnglish: 1, errors: 0,
      status: "pass_complete", hasMore: false, progressMade: true, passScanned: 13, passChanged: 2 });
    expect(result.samples).toEqual([{ slug: row(11).slug, from: "无间道风云", to: "The Departed" }]);
    expect(repo.saveState).toHaveBeenCalledWith(expect.objectContaining({ cursor: row(13).id, passScanned: 13, passChanged: 2 }));
    expect(repo.saveState).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: null, lastPassCompletedAt: expect.any(Date) }));
  });

  it("counts a lost compare-and-set as unchanged", async () => {
    repo.candidates.mockResolvedValueOnce([row(1, "变形金刚")]);
    client.fetchEnglishLabels = labelsFrom({ Q1: "Transformers" });
    repo.replaceTitle.mockResolvedValue(false);
    expect(await run()).toMatchObject({ changed: 0, unchanged: 1, samples: [] });
  });

  it("dry run never writes and stops at the limit", async () => {
    repo.candidates.mockImplementation(async (after: string | null, limit: number) => {
      const start = after ? Number(after.slice(-12)) + 1 : 1;
      return rows(start, limit).map((r) => ({ ...r, title: "原题" }));
    });
    const result = await run({ dryRun: true, limit: 120 });

    expect(repo.candidates.mock.calls.map((call: unknown[]) => call[1])).toEqual([50, 50, 20]);
    expect(result).toMatchObject({ mode: "dry-run", scanned: 120, changed: 120, hasMore: false, progressMade: false });
    expect(result.samples).toHaveLength(30);
    for (const write of [repo.state, repo.saveState, repo.replaceTitle, repo.recordWikidataCooldown, repo.wikidataCooldown]) expect(write).not.toHaveBeenCalled();
  });

  it("starts a new pass only after the repass interval", async () => {
    repo.state.mockResolvedValue(state({ lastPassCompletedAt: new Date(Date.now() - ENGLISH_TITLE_REPASS_MS + 60_000) }));
    expect(await run()).toMatchObject({ status: "idle", hasMore: false, progressMade: false });
    expect(repo.candidates).not.toHaveBeenCalled();

    repo.state.mockResolvedValue(state({ lastPassCompletedAt: new Date(Date.now() - ENGLISH_TITLE_REPASS_MS - 60_000) }));
    repo.candidates.mockResolvedValueOnce(rows(1, 50)).mockResolvedValueOnce([]);
    const result = await run({ maxRequests: 1 });
    expect(repo.saveState).toHaveBeenCalledWith({ passStartedAt: expect.any(Date), passScanned: 0, passChanged: 0 });
    expect(repo.candidates).toHaveBeenCalledWith(null, 50);
    expect(result).toMatchObject({ status: "progress", hasMore: true, progressMade: true, cursor: row(50).id });
  });

  it("honors the shared Wikidata cooldown without starting a chain", async () => {
    const until = new Date(Date.now() + 120_000);
    repo.state.mockResolvedValue(state({ cursor: row(5).id }));
    repo.wikidataCooldown.mockResolvedValue(until);
    expect(await run()).toMatchObject({ status: "cooldown", hasMore: true, progressMade: false, nextRunAt: until.toISOString() });
    expect(client.fetchEnglishLabels).not.toHaveBeenCalled();
  });

  it("records a provider cooldown from Retry-After and keeps the cursor", async () => {
    const retryAfter = new Date(Date.now() + 10 * 60_000);
    repo.state.mockResolvedValue(state({ cursor: row(5).id, failureCount: 1 }));
    repo.candidates.mockResolvedValue(rows(6, 50));
    client.fetchEnglishLabels.mockRejectedValue(new MovieSourceError("wikidata_http_429", retryAfter));

    const result = await run();

    expect(repo.recordWikidataCooldown).toHaveBeenCalledWith(retryAfter);
    expect(repo.saveState).toHaveBeenCalledWith({ failureCount: 2, errorCode: "wikidata_http_429" });
    expect(repo.saveState).not.toHaveBeenCalledWith(expect.objectContaining({ cursor: expect.anything() }));
    expect(result).toMatchObject({ status: "provider_error", errors: 1, hasMore: true, progressMade: true, nextRunAt: retryAfter.toISOString() });
  });

  it("stops the continuation chain after repeated provider failures", async () => {
    repo.state.mockResolvedValue(state({ cursor: row(5).id, failureCount: 4 }));
    repo.candidates.mockResolvedValue(rows(6, 50));
    client.fetchEnglishLabels.mockRejectedValue(new MovieSourceError("wikidata_request_failed"));
    expect(await run()).toMatchObject({ hasMore: false, errors: 1 });
  });

  it("bounds a run by its request budget", async () => {
    repo.state.mockResolvedValue(state({ cursor: row(0).id, passStartedAt: new Date() }));
    repo.candidates.mockImplementation(async (after: string) => rows(Number(after.slice(-12)) + 1, 50));
    const result = await run({ maxRequests: 3 });
    expect(client.fetchEnglishLabels).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ scanned: 150, hasMore: true, status: "progress", cursor: row(150).id });
  });
});

describe("parseEnglishTitleArgs", () => {
  it("accepts the job form and dry-run inspection flags", () => {
    expect(parseEnglishTitleArgs([])).toEqual({});
    expect(parseEnglishTitleArgs(["--dry-run", "--limit", "2000"])).toEqual({ dryRun: true, limit: 2000 });
    expect(parseEnglishTitleArgs(["--dry-run", "--after", row(7).id.toUpperCase()])).toEqual({ dryRun: true, after: row(7).id });
  });

  it("rejects writes with inspection flags and malformed values", () => {
    for (const argv of [["--limit", "5"], ["--after", row(1).id], ["--apply"], ["--dry-run", "--limit", "0"], ["--dry-run", "--after", "Q1"], ["--dry-run", "--limit"]]) {
      expect(() => parseEnglishTitleArgs(argv)).toThrow(ENGLISH_TITLE_USAGE);
    }
  });
});
