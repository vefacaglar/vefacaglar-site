import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMoviesRepository, MovieSourceState } from "../movies.repository.interface";
import { MovieSyncService } from "./movie-sync.service";
import { SyncMoviesHandler } from "./sync.handler";

const state = (): MovieSourceState => ({
  discoveryComplete: true,
  discoveryCycle: 1,
  discoveryStrategy: "wikidata-direct-film-v1",
  nextDiscoveryAt: new Date("2099-01-01"),
  cooldownUntil: null,
  artworkCooldownUntil: null,
  wikipediaArtworkCooldownUntil: null,
  failureCount: 0,
  refreshCursor: null,
  lastSuccessAt: null,
});

const entity = (qid = "Q47703") => ({
  id: qid,
  type: "item",
  labels: { en: { value: "The Godfather" } },
  lastrevid: 42,
  modified: "2026-11-05T00:00:00Z",
  sitelinks: {},
  claims: { P31: [{ id: `${qid}$class`, rank: "normal", mainsnak: { property: "P31", snaktype: "value", datavalue: { value: { id: "Q11424" } } } }] },
});

let repo: Record<keyof IMoviesRepository, any>;
let client: { fetchEntities: any; fetchLabels: any };
let discovery: { discover: any };
const run = (options = {}) => new SyncMoviesHandler(new MovieSyncService(repo, client, discovery)).handle(options);

beforeEach(() => {
  repo = {
    ensureSourceAndSeeds: vi.fn().mockResolvedValue({ inserted: 0, state: state() }),
    sourceState: vi.fn().mockResolvedValue(state()),
    saveSourceState: vi.fn(),
    insertDiscovered: vi.fn().mockResolvedValue(0),
    hydrationCandidates: vi.fn().mockResolvedValue([]),
    refreshCandidates: vi.fn().mockResolvedValue([]),
    recognitionCandidates: vi.fn().mockResolvedValue([]),
    persistMovie: vi.fn().mockResolvedValue("updated"),
    markEntityFailure: vi.fn(),
    findLabels: vi.fn().mockResolvedValue({}),
    labelRefreshCandidates: vi.fn().mockResolvedValue([]),
    writeLabels: vi.fn(),
    hasPendingWork: vi.fn().mockResolvedValue(false),
    listPublic: vi.fn(),
    findPublicPersonHeader: vi.fn(),
    hydratePublicIds: vi.fn(),
    findPublicPerson: vi.fn(),
    findPublicBySlug: vi.fn(),
  };
  client = { fetchEntities: vi.fn().mockResolvedValue({ Q47703: entity() }), fetchLabels: vi.fn().mockResolvedValue({}) };
  discovery = { discover: vi.fn() };
});

describe("bounded movie sync handler", () => {
  it("persists validated seeds, never performs poster fetching, and stops at the request budget without network fanout", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    repo.hasPendingWork.mockResolvedValue(true);
    const result = await run({ maxRequests: 1 });
    expect(result).toMatchObject({
      hydrated: 1,
      postersChecked: 0,
      postersUpdated: 0,
      posterFailures: 0,
      requests: 1,
      hasMore: true,
      progressMade: true,
    });
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ title: "The Godfather", isFilm: true }), expect.any(Date));
    expect(client.fetchLabels).not.toHaveBeenCalled();
  });

  it("hydrates films using an available source-language title when English and original-title claims are absent", async () => {
    const raw = { ...entity(), labels: { bn: { value: "একটি চলচ্চিত্র" } } };
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    client.fetchEntities.mockResolvedValue({ Q47703: raw });
    expect(await run({ maxRequests: 1 })).toMatchObject({ hydrated: 1, failed: 0, requests: 1 });
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ title: "একটি চলচ্চিত্র" }), expect.any(Date));
    expect(repo.markEntityFailure).not.toHaveBeenCalled();
  });

  it("does not replace data for missing/partial entities", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    client.fetchEntities.mockResolvedValue({ Q47703: { id: "Q47703", missing: "" } });
    const result = await run({ maxRequests: 1 });
    expect(result.failed).toBe(1);
    expect(repo.persistMovie).not.toHaveBeenCalled();
    expect(repo.markEntityFailure).toHaveBeenCalledWith("Q47703", "incomplete_or_invalid_entity", expect.any(Date));
  });

  it("preserves newer facts when a stale source revision is returned", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: 99 }]);
    expect(await run({ maxRequests: 1 })).toMatchObject({ failed: 1, hydrated: 0 });
    expect(repo.persistMovie).not.toHaveBeenCalled();
  });

  it("keeps valid claims when a supporting-label request fails", async () => {
    const raw = entity();
    (raw.claims as any).P57 = [{ id: "Q47703$director", rank: "normal", mainsnak: { property: "P57", snaktype: "value", datavalue: { value: { id: "Q123" } } } }];
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: null }]);
    client.fetchEntities.mockResolvedValue({ Q47703: raw });
    client.fetchLabels.mockRejectedValue(new Error("unavailable"));
    expect(await run()).toMatchObject({ hydrated: 1, hasMore: true });
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ credits: [expect.objectContaining({ personQid: "Q123" })] }), expect.any(Date));
  });

  it("durably replays discovery and marks a cycle complete only on verified completion", async () => {
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 5, state: { ...state(), discoveryComplete: false, nextDiscoveryAt: null } });
    repo.insertDiscovered.mockResolvedValue(2);
    discovery.discover.mockImplementation(async (batch: any) => {
      await batch(["Q1", "Q2"]);
      return { complete: true, strategy: "wikidata-direct-film-v1", discovered: 2 };
    });
    const result = await run({ maxRequests: 1 });
    expect(result.discovered).toBe(2);
    expect(repo.saveSourceState).toHaveBeenCalledWith(expect.objectContaining({ discoveryComplete: true, discoveryCycle: 2 }));
    expect(repo.insertDiscovered).toHaveBeenCalledWith(["Q1", "Q2"]);
  });

  it("persists cooldown and never loops a duplicate run during that cooldown", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    client.fetchEntities.mockRejectedValue({ retryAfter: new Date(Date.now() + 120_000) });
    const result = await run();
    expect(result).toMatchObject({ hasMore: true, progressMade: true, hydrated: 0 });
    expect(repo.persistMovie).not.toHaveBeenCalled();
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 0, state: { ...state(), cooldownUntil: new Date(Date.now() + 120_000) } });
    expect(await run()).toMatchObject({ hasMore: false, progressMade: false, requests: 0 });
  });

  it("stops repeated provider failures and does not turn SQL failures into cooldown success", async () => {
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 0, state: { ...state(), failureCount: 3 } });
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    client.fetchEntities.mockRejectedValue(new Error("unavailable"));
    expect(await run()).toMatchObject({ hasMore: false, hydrated: 0 });
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 0, state: { ...state(), discoveryComplete: false } });
    discovery.discover.mockImplementation(async (batch: any) => batch(["Q1"]));
    repo.insertDiscovered.mockRejectedValue(new Error("private database details"));
    await expect(run()).rejects.toThrow("movie_database_write_failed");
  });

  it("handles IMDb conflict per movie and produces no continuation on a no-op window", async () => {
    expect(await run()).toMatchObject({ hasMore: false, progressMade: false });
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    repo.persistMovie.mockResolvedValue("imdb_conflict");
    expect(await run({ maxRequests: 1 })).toMatchObject({ hydrated: 1, imdbConflicts: 1 });
  });

  it("does not replace a known movie with an unversioned entity response", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: 41 }]);
    const raw = entity() as Record<string, unknown>;
    delete raw.lastrevid;
    client.fetchEntities.mockResolvedValue({ Q47703: raw });
    expect(await run({ maxRequests: 1 })).toMatchObject({ failed: 1, hydrated: 0 });
    expect(repo.persistMovie).not.toHaveBeenCalled();
  });

  it("removes public film classification only from a complete newer snapshot", async () => {
    repo.refreshCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: 41 }]);
    client.fetchEntities.mockResolvedValue({ Q47703: { ...entity(), claims: {} } });
    expect(await run({ maxRequests: 1 })).toMatchObject({ refreshed: 1 });
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ isFilm: false, sourceRevision: 42 }), expect.any(Date));
  });

  it("refreshes known stale supporting names within the request budget", async () => {
    const raw = entity();
    (raw.claims as any).P57 = [{ id: "Q47703$director", rank: "normal", mainsnak: { property: "P57", snaktype: "value", datavalue: { value: { id: "Q123" } } } }];
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: null }]);
    repo.findLabels.mockResolvedValue({ Q123: { name: "Previous name", checkedAt: new Date(Date.now() - 8 * 86_400_000) } });
    client.fetchEntities.mockResolvedValue({ Q47703: raw });
    client.fetchLabels.mockResolvedValue({ Q123: "Current name" });
    expect(await run({ maxRequests: 2 })).toMatchObject({ requests: 2, labelsChecked: 1 });
    expect(repo.writeLabels).toHaveBeenCalledWith({ Q123: "Current name" }, expect.any(Date));
  });

  it("honors a provider cooldown longer than one day", async () => {
    const retryAfter = new Date(Date.now() + 3 * 86_400_000);
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: null }]);
    client.fetchEntities.mockRejectedValue({ retryAfter });
    const result = await run();
    expect(result.nextRunAt).toBe(retryAfter.toISOString());
    expect(repo.saveSourceState).toHaveBeenCalledWith(expect.objectContaining({ cooldownUntil: retryAfter }));
  });

  it("continues a rotating refresh after durably wrapping the cursor", async () => {
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 0, state: { ...state(), refreshCursor: "last" } });
    repo.refreshCandidates.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "first", wikidataId: "Q1", sourceRevision: 1 }]);
    expect(await run()).toMatchObject({ hasMore: true, progressMade: true, requests: 0 });
    expect(repo.saveSourceState).toHaveBeenCalledWith({ refreshCursor: null });
  });

  it("ends the chain after wrapping a cursor when remaining work is not due", async () => {
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 0, state: { ...state(), refreshCursor: "last" } });
    expect(await run()).toMatchObject({ hasMore: false, progressMade: true, requests: 0 });
    expect(repo.saveSourceState).toHaveBeenCalledWith({ refreshCursor: null });
  });

  it("uses spare capacity for multiple refresh batches and counts them against the movie limit", async () => {
    const candidates = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({
      id: String(start + i), wikidataId: `Q${start + i}`, sourceRevision: 41,
    }));
    repo.refreshCandidates.mockResolvedValueOnce(candidates(1, 50)).mockResolvedValueOnce(candidates(51, 50));
    client.fetchEntities.mockImplementation(async (qids: string[]) => Object.fromEntries(qids.map((qid) => [qid, entity(qid)])));
    const result = await run({ maxMovies: 75 });
    expect(result).toMatchObject({ refreshed: 75, hydrated: 0, failed: 0, requests: 2 });
    expect(repo.persistMovie).toHaveBeenCalledTimes(75);
    expect(repo.saveSourceState).toHaveBeenCalledWith({ refreshCursor: "75" });
    expect(repo.refreshCandidates).toHaveBeenNthCalledWith(2, "50", 25, expect.any(Date), expect.any(Date));
  });

  it("backfills recognition at unchanged revisions while reserving normal refresh capacity and cursor", async () => {
    const candidates = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({
      id: String(start + i), wikidataId: `Q${start + i}`, sourceRevision: 42,
    }));
    repo.recognitionCandidates.mockResolvedValueOnce(candidates(1, 50));
    repo.refreshCandidates.mockResolvedValueOnce(candidates(100, 50));
    client.fetchEntities.mockImplementation(async (qids: string[]) => Object.fromEntries(qids.map((qid) => [qid, entity(qid)])));
    expect(await run({ maxMovies: 75 })).toMatchObject({ refreshed: 75, requests: 2, failed: 0 });
    expect(repo.recognitionCandidates).toHaveBeenNthCalledWith(1, 37, expect.any(Date));
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ sourceRevision: 42, wikipediaLanguageCount: 0 }), expect.any(Date));
    expect(repo.saveSourceState).not.toHaveBeenCalledWith({ refreshCursor: "37" });
    expect(repo.saveSourceState).toHaveBeenCalledWith({ refreshCursor: "137" });
  });

  it("does not spend the last request on recognition ahead of an ordinary refresh", async () => {
    repo.recognitionCandidates.mockResolvedValue([{ id: "pending", wikidataId: "Q2", sourceRevision: 42 }]);
    repo.refreshCandidates.mockResolvedValueOnce([{ id: "normal", wikidataId: "Q1", sourceRevision: 42 }]);
    client.fetchEntities.mockResolvedValue({ Q1: entity("Q1") });
    expect(await run({ maxRequests: 1 })).toMatchObject({ refreshed: 1, requests: 1, hasMore: true });
    expect(client.fetchEntities).toHaveBeenCalledWith(["Q1"], expect.anything());
    expect(repo.recognitionCandidates).toHaveBeenCalledTimes(1);
  });
});

describe("shared Wikidata cooldown during a fact window", () => {
  it("stops before another request when a parallel title mapper reports a cooldown", async () => {
    const cooldownUntil = new Date(Date.now() + 120000);
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    repo.sourceState.mockResolvedValue({ ...state(), cooldownUntil });
    expect(await run()).toMatchObject({ requests: 0, hydrated: 0, nextRunAt: cooldownUntil.toISOString() });
    expect(client.fetchEntities).not.toHaveBeenCalled();
    expect(repo.saveSourceState).not.toHaveBeenCalledWith(expect.objectContaining({ cooldownUntil: null }));
  });
});
