import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMoviesRepository, MovieSourceState } from "../movies.repository.interface";
import { MovieSyncService } from "./movie-sync.service";
import { SyncMoviesHandler } from "./sync.handler";
const state = (): MovieSourceState => ({ discoveryComplete: true, discoveryCycle: 1, discoveryStrategy: "wikidata-direct-film-v1", nextDiscoveryAt: new Date("2099-01-01"), cooldownUntil: null, artworkCooldownUntil: null, wikipediaArtworkCooldownUntil: null, failureCount: 0, refreshCursor: null, lastSuccessAt: null });
const entity = (qid = "Q47703") => ({ id: qid, type: "item", labels: { en: { value: "The Godfather" } }, lastrevid: 42, modified: "2026-11-05T00:00:00Z",
  sitelinks: {}, claims: { P31: [{ id: `${qid}$class`, rank: "normal", mainsnak: { property: "P31", snaktype: "value", datavalue: { value: { id: "Q11424" } } } }] } });
let repo: Record<keyof IMoviesRepository, any>;
let client: { fetchEntities: any; fetchLabels: any };
let discovery: { discover: any };
let posters: { fetchPosters: any };
let wikipedia: { resolveArticles: any; fetchPosters: any };
const run = (options = {}) => new SyncMoviesHandler(new MovieSyncService(repo, client, discovery, posters, wikipedia)).handle(options);
beforeEach(() => {
  repo = { ensureSourceAndSeeds: vi.fn().mockResolvedValue({ inserted: 0, state: state() }), sourceState: vi.fn().mockResolvedValue(state()), saveSourceState: vi.fn(), insertDiscovered: vi.fn().mockResolvedValue(0),
    hydrationCandidates: vi.fn().mockResolvedValue([]), refreshCandidates: vi.fn().mockResolvedValue([]), persistMovie: vi.fn().mockResolvedValue("updated"), markEntityFailure: vi.fn(),
    findLabels: vi.fn().mockResolvedValue({}), labelRefreshCandidates: vi.fn().mockResolvedValue([]), writeLabels: vi.fn(), hasPendingWork: vi.fn().mockResolvedValue(false), listPublic: vi.fn(), findPublicBySlug: vi.fn(),
    posterInputsCandidates: vi.fn().mockResolvedValue([]), posterCandidates: vi.fn().mockResolvedValue([]), persistPoster: vi.fn().mockResolvedValue(true), markPosterFailure: vi.fn() };
  client = { fetchEntities: vi.fn().mockResolvedValue({ Q47703: entity() }), fetchLabels: vi.fn().mockResolvedValue({}) };
  discovery = { discover: vi.fn() };
  posters = { fetchPosters: vi.fn().mockResolvedValue({}) };
  wikipedia = { resolveArticles: vi.fn().mockResolvedValue({}), fetchPosters: vi.fn().mockResolvedValue({}) };
});

describe("movie artwork synchronization", () => {
  const candidate = { id: "a", wikidataId: "Q47703", title: "The Godfather", fileName: "Poster.jpg", enwikiArticle: null, version: 1, hasImage: false, resolvedFrom: null };
  const poster = { imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Poster.jpg/500px-Poster.jpg",
    attribution: { sourceUrl: "https://commons.wikimedia.org/wiki/File:Poster.jpg", artist: "Studio", license: "Public domain", licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Copyright_tags#Public_domain" } };
  it("fills licensed posters independently of Wikidata revisions", async () => {
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": poster });
    expect(await run()).toMatchObject({ postersChecked: 1, postersUpdated: 1, requests: 1, progressMade: true, hasMore: false });
    expect(repo.persistPoster).toHaveBeenCalledWith(candidate, poster, expect.any(Date));
    expect(client.fetchEntities).not.toHaveBeenCalled();
  });
  it("negative-caches authoritative missing or unlicensed posters", async () => {
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": null });
    expect(await run()).toMatchObject({ postersChecked: 1, postersUpdated: 0 });
    expect(repo.persistPoster).toHaveBeenCalledWith(candidate, null, expect.any(Date));
  });
  it("preserves stored artwork on provider outages and still hydrates movie content", async () => {
    const retryAfter = new Date(Date.now() + 3600_000);
    repo.posterCandidates.mockImplementation(async (_limit, _now, available) => available?.commons === false ? [] : [candidate]);
    repo.hydrationCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703" }]);
    posters.fetchPosters.mockRejectedValue({ retryAfter });
    expect(await run()).toMatchObject({ hydrated: 1, posterFailures: 1, postersChecked: 0, hasMore: false });
    expect(repo.persistPoster).not.toHaveBeenCalled();
    expect(repo.markPosterFailure).toHaveBeenCalledWith([candidate], retryAfter);
    expect(repo.saveSourceState).toHaveBeenCalledWith({ artworkCooldownUntil: retryAfter });
    expect(posters.fetchPosters).toHaveBeenCalledTimes(1);
  });
  it("can refresh artwork during a Wikidata cooldown", async () => {
    repo.ensureSourceAndSeeds.mockResolvedValue({ inserted: 0, state: { ...state(), cooldownUntil: new Date(Date.now() + 3600_000) } });
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": poster });
    expect(await run()).toMatchObject({ postersUpdated: 1, hydrated: 0 });
    expect(client.fetchEntities).not.toHaveBeenCalled();
  });
  it("honors shared request budgets and bounds poster-only continuations", async () => {
    repo.posterCandidates.mockResolvedValue([candidate]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": poster });
    expect(await run({ maxRequests: 1 })).toMatchObject({ postersChecked: 1, requests: 1, hasMore: true });
    expect(posters.fetchPosters).toHaveBeenCalledTimes(1);
  });
  it("does not count a stale compare-and-swap response as committed progress", async () => {
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": poster });
    repo.persistPoster.mockResolvedValue(false);
    expect(await run()).toMatchObject({ postersChecked: 0, postersUpdated: 0, progressMade: false, hasMore: false });
  });
  it("keeps Commons preferred when an article fallback is also available", async () => {
    repo.posterCandidates.mockResolvedValueOnce([{ ...candidate, enwikiArticle: "The Godfather" }]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": poster });
    expect(await run()).toMatchObject({ postersUpdated: 1, requests: 1 });
    expect(wikipedia.resolveArticles).not.toHaveBeenCalled();
  });
  it("preserves an existing Commons image instead of replacing it during a Commons outage", async () => {
    repo.posterCandidates.mockResolvedValueOnce([{ ...candidate, enwikiArticle: "The Godfather", hasImage: true, resolvedFrom: "commons" }]);
    posters.fetchPosters.mockRejectedValue(new Error("unavailable"));
    expect(await run()).toMatchObject({ postersUpdated: 0, posterFailures: 1 });
    expect(repo.persistPoster).not.toHaveBeenCalled();
    expect(wikipedia.resolveArticles).not.toHaveBeenCalled();
  });
});

describe("Wikipedia fallback orchestration", () => {
  const candidate = { id: "a", wikidataId: "Q47703", title: "The Godfather", fileName: null, enwikiArticle: "The Godfather", version: 1, hasImage: false, resolvedFrom: null };
  const reference = { wikidataId: "Q47703", title: "The Godfather", article: "The Godfather", fileName: "Godfather ver1.jpg" };
  const poster = { imageUrl: "https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_ver1.jpg", origin: "wikipedia", fileName: reference.fileName,
    attribution: { provider: "wikipedia", rightsKind: "non-free", artist: null, license: "Fair use", licenseUrl: null, sourceUrl: "https://en.wikipedia.org/wiki/File:Godfather_ver1.jpg" } };
  it("counts article and file requests separately and publishes accurate non-free metadata", async () => {
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    wikipedia.resolveArticles.mockResolvedValue({ Q47703: reference });
    wikipedia.fetchPosters.mockResolvedValue({ Q47703: poster });
    expect(await run({ maxRequests: 2 })).toMatchObject({ requests: 2, postersUpdated: 1, posterFailures: 0 });
    expect(repo.persistPoster).toHaveBeenCalledWith(candidate, poster, expect.any(Date));
  });
  it("does not start a two-phase fallback with only one remaining request", async () => {
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    expect(await run({ maxRequests: 1 })).toMatchObject({ requests: 0, postersChecked: 0 });
    expect(wikipedia.resolveArticles).not.toHaveBeenCalled();
    expect(repo.persistPoster).not.toHaveBeenCalled();
  });
  it("never caches an unattempted fallback as missing after a Commons request exhausted its budget", async () => {
    repo.posterCandidates.mockResolvedValueOnce([{ ...candidate, fileName: "Poster.jpg" }]);
    posters.fetchPosters.mockResolvedValue({ "Poster.jpg": null });
    expect(await run({ maxRequests: 2 })).toMatchObject({ requests: 1, postersChecked: 0 });
    expect(repo.persistPoster).not.toHaveBeenCalled();
    expect(wikipedia.resolveArticles).not.toHaveBeenCalled();
  });
  it("negative-caches an authoritative absent or wrong-QID article without a file request", async () => {
    repo.posterCandidates.mockResolvedValueOnce([candidate]);
    wikipedia.resolveArticles.mockResolvedValue({ Q47703: null });
    expect(await run()).toMatchObject({ requests: 1, postersChecked: 1, postersUpdated: 0 });
    expect(repo.persistPoster).toHaveBeenCalledWith(candidate, null, expect.any(Date));
    expect(wikipedia.fetchPosters).not.toHaveBeenCalled();
  });
  it("persists an independent Wikipedia cooldown and preserves artwork after a file request fails", async () => {
    const retryAfter = new Date(Date.now() + 3600_000);
    repo.posterCandidates.mockResolvedValueOnce([{ ...candidate, hasImage: true, resolvedFrom: "wikipedia" }]);
    wikipedia.resolveArticles.mockResolvedValue({ Q47703: reference });
    wikipedia.fetchPosters.mockRejectedValue({ retryAfter });
    expect(await run()).toMatchObject({ requests: 2, posterFailures: 1, postersUpdated: 0 });
    expect(repo.persistPoster).not.toHaveBeenCalled();
    expect(repo.markPosterFailure).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })], retryAfter);
    expect(repo.saveSourceState).toHaveBeenCalledWith({ wikipediaArtworkCooldownUntil: retryAfter });
    expect(repo.saveSourceState).not.toHaveBeenCalledWith(expect.objectContaining({ cooldownUntil: expect.any(Date) }));
  });
  it("can still resolve an unfilled article poster during a Commons outage", async () => {
    repo.posterCandidates.mockResolvedValueOnce([{ ...candidate, fileName: "Poster.jpg" }]);
    posters.fetchPosters.mockRejectedValue(new Error("commons unavailable"));
    wikipedia.resolveArticles.mockResolvedValue({ Q47703: reference });
    wikipedia.fetchPosters.mockResolvedValue({ Q47703: poster });
    expect(await run()).toMatchObject({ requests: 3, posterFailures: 1, postersUpdated: 1 });
  });
  it("bootstraps sitelinks for recently checked priority films without advancing the normal refresh cursor", async () => {
    repo.posterInputsCandidates.mockResolvedValueOnce([{ id: "a", wikidataId: "Q47703", sourceRevision: 42 }]);
    client.fetchEntities.mockResolvedValue({ Q47703: { ...entity(), sitelinks: { enwiki: { site: "enwiki", title: "The Godfather" } } } });
    expect(await run()).toMatchObject({ refreshed: 1, requests: 1, hasMore: false });
    expect(repo.persistMovie).toHaveBeenCalledWith(expect.objectContaining({ sourceRevision: 42, enwikiArticle: "The Godfather" }), expect.any(Date));
    expect(repo.saveSourceState).not.toHaveBeenCalledWith({ refreshCursor: "a" });
  });
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
