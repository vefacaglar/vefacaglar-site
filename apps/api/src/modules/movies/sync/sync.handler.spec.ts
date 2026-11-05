import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMoviesRepository, MovieSourceState } from "../movies.repository.interface";
import { MovieSyncService } from "./movie-sync.service";
import { SyncMoviesHandler } from "./sync.handler";
const state = (): MovieSourceState => ({ discoveryComplete: true, discoveryCycle: 1, discoveryStrategy: "wikidata-direct-film-v1", nextDiscoveryAt: new Date("2099-01-01"), cooldownUntil: null, failureCount: 0, refreshCursor: null, lastSuccessAt: null });
const entity = (qid = "Q47703") => ({ id: qid, type: "item", labels: { en: { value: "The Godfather" } }, lastrevid: 42,
  claims: { P31: [{ id: `${qid}$class`, rank: "normal", mainsnak: { property: "P31", snaktype: "value", datavalue: { value: { id: "Q11424" } } } }] } });
let repo: Record<keyof IMoviesRepository, any>;
let client: { fetchEntities: any; fetchLabels: any };
let discovery: { discover: any };
const run = (options = {}) => new SyncMoviesHandler(new MovieSyncService(repo, client, discovery)).handle(options);
beforeEach(() => {
  repo = { ensureSourceAndSeeds: vi.fn().mockResolvedValue({ inserted: 0, state: state() }), sourceState: vi.fn(), saveSourceState: vi.fn(), insertDiscovered: vi.fn().mockResolvedValue(0),
    hydrationCandidates: vi.fn().mockResolvedValue([]), refreshCandidates: vi.fn().mockResolvedValue([]), persistMovie: vi.fn().mockResolvedValue("updated"), markEntityFailure: vi.fn(),
    findLabels: vi.fn().mockResolvedValue({}), unresolvedLabels: vi.fn().mockResolvedValue([]), writeLabels: vi.fn(), hasPendingWork: vi.fn().mockResolvedValue(false), listPublic: vi.fn(), findPublicBySlug: vi.fn() };
  client = { fetchEntities: vi.fn().mockResolvedValue({ Q47703: entity() }), fetchLabels: vi.fn().mockResolvedValue({}) };
  discovery = { discover: vi.fn() };
});
describe("bounded movie sync handler", () => {
  it("persists validated seeds and stops at the request budget without network fanout", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    repo.hasPendingWork.mockResolvedValue(true);
    const result = await run({ maxRequests: 1 });
    expect(result).toMatchObject({ hydrated: 1, requests: 1, hasMore: true, progressMade: true });
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ title: "The Godfather", isFilm: true }), expect.any(Date));
    expect(client.fetchLabels).not.toHaveBeenCalled();
  });
  it("does not replace data for missing/partial entities", async () => {
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    client.fetchEntities.mockResolvedValue({ Q47703: { id: "Q47703", missing: "" } });
    const result = await run({ maxRequests: 1 });
    expect(result.failed).toBe(1); expect(repo.persistMovie).not.toHaveBeenCalled();
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
    discovery.discover.mockImplementation(async (batch: any) => { await batch(["Q1", "Q2"]); return { complete: true, strategy: "wikidata-direct-film-v1", discovered: 2 }; });
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
});
