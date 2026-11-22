import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PopularityDiscoveryService } from "./popularity-discovery.service";
import type { ImportGameHandler } from "../import/import.handler";
import type { OwnerRankingService } from "./owner-ranking.service";
import { RefreshPopularityHandler } from "./popularity.handler";
import { computePopularityScores, type PopularityInput } from "./popularity-score";
import type { IGamesRepository } from "../games.repository.interface";
import type { IIgdbClient } from "../import/import.types";
import type { IEventBus } from "../../../shared/events/event-bus";

const at = (iso: string) => new Date(iso);

describe("computePopularityScores", () => {
  it("does not invent current interest from historical ratings or reviews", () => {
    const scores = computePopularityScores([
      { id: "historical", signals: { played: 10_000_000, steamReviews: 5_000_000, ratingCount: 1_000_000 } } as unknown as PopularityInput,
      { id: "unknown", signals: {} },
    ]);
    expect(scores.get("historical")).toBeNull();
    expect(scores.get("unknown")).toBeNull();
  });

  it("makes current visits dominant over playing and Steam 24-hour activity", () => {
    const scores = computePopularityScores([
      { id: "current", signals: { visits: 1000, playing: 1, steam24hPeak: 1 } },
      { id: "other", signals: { visits: 10, playing: 1000, steam24hPeak: 1000 } },
    ]);
    expect(scores.get("current")).toBeCloseTo((0.7 + 0.3 / Math.sqrt(1000)) / 1.05);
    expect(scores.get("other")).toBeCloseTo(0.37 / 1.05);
  });

  it("ranks recent interest above an older game with enormous lifetime counters", () => {
    const scores = computePopularityScores([
      { id: "old", signals: { visits: 1, playing: 1, steam24hPeak: 1, played: 1e9, ratingCount: 1e9 } } as unknown as PopularityInput,
      { id: "recent", signals: { visits: 100, playing: 10, steam24hPeak: 10 } },
    ]);
    expect(scores.get("recent")).toBeCloseTo(1 / 1.05);
    expect(scores.get("old")).toBeCloseTo((0.07 + 0.3 / Math.sqrt(10)) / 1.05);
  });

  it("bounds missing-signal contributions and preserves audience-size differences", () => {
    const scores = computePopularityScores([
      { id: "visits", signals: { visits: 500 } },
      { id: "both", signals: { visits: 100, playing: 10 } },
      { id: "playing", signals: { playing: 1000 } },
    ]);
    expect(scores.get("visits")).toBeCloseTo(0.7 / 1.05);
    expect(scores.get("both")).toBeCloseTo((0.7 * Math.sqrt(0.2) + 0.02) / 1.05);
    expect(scores.get("playing")).toBeCloseTo(0.2 / 1.05);
  });

  it("gives single-player only a small relative edge while popularity gaps win", () => {
    const scores = computePopularityScores([
      { id: "sp", singlePlayer: true, signals: { visits: 95 } },
      { id: "close", signals: { visits: 100 } },
      { id: "popular", signals: { visits: 120 } },
      { id: "unknown", singlePlayer: true, signals: {} },
      { id: "zero", singlePlayer: true, signals: { visits: 0 } },
      { id: "steam", signals: { steam24hPeak: 1_000_000 } },
    ]);
    expect(scores.get("sp")!).toBeGreaterThan(scores.get("close")!);
    expect(scores.get("popular")!).toBeGreaterThan(scores.get("sp")!);
    expect(scores.get("steam")).toBeCloseTo(0.1 / 1.05);
    expect(scores.get("unknown")).toBeNull();
    expect(scores.get("zero")).toBe(0);
  });

  it("keeps measured zero activity at zero, including a single-game or all-zero cohort", () => {
    expect(computePopularityScores([{ id: "zero", signals: { visits: 0 } }]).get("zero")).toBe(0);
    const scores = computePopularityScores([
      { id: "zero", signals: { visits: 0, playing: 0 } },
      { id: "also-zero", signals: { visits: 0, playing: 0 } },
      { id: "unknown", signals: {} },
    ]);
    expect(scores.get("zero")).toBe(0);
    expect(scores.get("also-zero")).toBe(0);
    expect(scores.get("unknown")).toBeNull();
  });

  it("ignores non-finite and negative activity without converting it to measured zero", () => {
    const scores = computePopularityScores([
      { id: "invalid", signals: { visits: Number.NaN, playing: Number.POSITIVE_INFINITY, steam24hPeak: -1 } },
      { id: "valid", signals: { visits: 5 } },
    ]);
    expect(scores.get("invalid")).toBeNull();
    expect(scores.get("valid")).toBeCloseTo(0.7 / 1.05);
  });
});

describe("RefreshPopularityHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let eventBus: Record<keyof IEventBus, any>;
  let handler: RefreshPopularityHandler;
  let discovery: { discover: ReturnType<typeof vi.fn> };
  let ownerRanking: { backfillGameModes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    gamesRepo = {
      listPopularitySources: vi.fn().mockResolvedValue([
        { id: "g-a", igdbId: 1, igdbRatingCount: 100, popularityScore: null },
        { id: "g-b", igdbId: 2, igdbRatingCount: 10, popularityScore: 0.5 },
        { id: "g-c", igdbId: 3, igdbRatingCount: 100_000_000, popularityScore: null },
      ]),
      writePopularity: vi.fn().mockResolvedValue(undefined),
    } as unknown as Record<keyof IGamesRepository, any>;
    igdb = {
      findGame: vi.fn(), listGames: vi.fn(),
      listPopularity: vi.fn().mockResolvedValue([
        { igdbId: 999, popularityType: 1, value: 1000, calculatedAt: at("2026-11-01T00:00:00Z") },
        { igdbId: 1, popularityType: 1, value: 1000, calculatedAt: at("2026-11-01T00:00:00Z") },
        { igdbId: 2, popularityType: 1, value: 10, calculatedAt: at("2026-11-01T00:00:00Z") },
        { igdbId: 2, popularityType: 1, value: 99_999, calculatedAt: at("2026-10-01T00:00:00Z") },
        { igdbId: 3, popularityType: 4, value: 1e9, calculatedAt: at("2026-11-01T00:00:00Z") },
      ]),
    };
    eventBus = { publish: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn() };
    ownerRanking = { backfillGameModes: vi.fn().mockResolvedValue({ checkedCount: 0, status: "complete" }) };
    discovery = { discover: vi.fn().mockResolvedValue(0) };
    handler = new RefreshPopularityHandler(gamesRepo as unknown as IGamesRepository, igdb as unknown as IIgdbClient,
      eventBus as unknown as IEventBus, ownerRanking as unknown as OwnerRankingService, discovery as unknown as PopularityDiscoveryService);
  });


  afterEach(() => { vi.useRealTimers(); });

  it("writes versioned taste scores from refreshed interest and verified metadata", async () => {
    const sources = await gamesRepo.listPopularitySources();
    Object.assign(sources[0], { hasAction: true, hasRpg: true, hasOpenWorld: true, gameModeIds: [1] });
    Object.assign(sources[1], { hasAction: true, hasRpg: false, hasOpenWorld: false, gameModeIds: [2] });
    ownerRanking.backfillGameModes.mockResolvedValue({ checkedCount: 500, status: "budget" });
    const result = await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0]).toMatchObject({
      recommendationVersion: "owner-taste-v1",
      recommendationScores: [{ id: "g-a", score: 0.895 }, { id: "g-b", score: expect.closeTo(0.35 * 0.7 * 0.1 / 1.05) }, { id: "g-c", score: 0 }],
    });
    expect(result).toMatchObject({ recommendationScoredCount: 3, gameModesCheckedCount: 500, gameModesStatus: "budget" });
  });

  it("reindexes a changed taste score even when current interest is unchanged", async () => {
    const sources = await gamesRepo.listPopularitySources();
    Object.assign(sources[0], { popularityScore: 0.7, recommendationScore: 0.35, hasRpg: true, gameModeIds: [1] });
    Object.assign(sources[1], { popularityScore: 0.7 * 0.1 / 1.05, recommendationScore: 0.35 * 0.7 * 0.1 / 1.05 });
    Object.assign(sources[2], { popularityScore: null, recommendationScore: 0 });
    await handler.handle();
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ gameIds: ["g-a"] }), { throwOnError: undefined });
  });

  it("keeps unknown mode metadata usable when optional mode hydration is unavailable", async () => {
    ownerRanking.backfillGameModes.mockResolvedValue({ checkedCount: 0, status: "unavailable" });
    const result = await handler.handle();
    expect(result.gameModesStatus).toBe("unavailable");
    expect(gamesRepo.writePopularity.mock.calls[0][0].recommendationScores[0].score).toBeCloseTo(0.35 * 0.7 / 1.05);
  });

  it("fetches current types globally and matches the returned game ids locally", async () => {
    await handler.handle();
    expect(igdb.listPopularity).toHaveBeenCalledWith([1, 3, 5]);
    const write = gamesRepo.writePopularity.mock.calls[0][0];
    expect(write.popularityTypes).toEqual([1, 3, 5]);
    expect(write.signals).toEqual([
      { gameId: "g-a", popularityType: 1, value: 1000, calculatedAt: at("2026-11-01T00:00:00Z") },
      { gameId: "g-b", popularityType: 1, value: 10, calculatedAt: at("2026-11-01T00:00:00Z") },
    ]);
    expect(write.scores).toEqual([{ id: "g-a", score: 0.7 / 1.05 }, { id: "g-b", score: 0.7 * 0.1 / 1.05 }, { id: "g-c", score: null }]);
  });

  it("reindexes changed games and reports counts", async () => {
    const result = await handler.handle();
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "games.imported", gameIds: ["g-a", "g-b", "g-c"] }), { throwOnError: undefined });
    expect(result).toMatchObject({ gameCount: 3, signalCount: 2, scoredCount: 2, reindexedCount: 3 });
  });

  it("can discover games even when the catalog starts empty", async () => {
    gamesRepo.listPopularitySources.mockResolvedValue([]);
    const result = await handler.handle();
    expect(result).toMatchObject({ gameCount: 0, signalCount: 0, scoredCount: 0, reindexedCount: 0 });
    expect(igdb.listPopularity).toHaveBeenCalled();
    expect(discovery.discover).toHaveBeenCalled();
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [{ igdbId: 999, popularityType: 1, value: 100, calculatedAt: at("2026-11-01T00:00:00Z") }],
    [{ igdbId: 1, popularityType: 1, value: Number.NaN, calculatedAt: at("2026-11-01T00:00:00Z") }],
    [{ igdbId: 1, popularityType: 1, value: -1, calculatedAt: at("2026-11-01T00:00:00Z") }],
    [{ igdbId: 1, popularityType: 4, value: 100, calculatedAt: at("2026-11-01T00:00:00Z") }],
  ].map((primitives) => ({ primitives })))("keeps existing scores when no applicable current provider data exists ($primitives)", async ({ primitives }) => {
    igdb.listPopularity.mockResolvedValue(primitives);
    await expect(handler.handle()).rejects.toThrow("existing scores were kept");
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("excludes stale, undated, and future observations from discovery and scores", async () => {
    igdb.listPopularity.mockResolvedValue([
      { igdbId: 1, popularityType: 1, value: 100, calculatedAt: at("2026-11-01T00:00:00Z") },
      { igdbId: 2, popularityType: 5, value: 1e9, calculatedAt: at("2026-10-28T00:00:00Z") },
      { igdbId: 3, popularityType: 1, value: 1e9, calculatedAt: null },
      { igdbId: 3, popularityType: 3, value: 1e9, calculatedAt: at("2026-11-03T00:00:00Z") },
    ]);
    await handler.handle();
    expect(discovery.discover.mock.calls[0][0]).toHaveLength(1);
    expect(gamesRepo.writePopularity.mock.calls[0][0].sourceDates).toEqual([
      { id: "g-a", calculatedAt: at("2026-11-01T00:00:00Z") },
      { id: "g-b", calculatedAt: null }, { id: "g-c", calculatedAt: null },
    ]);
    expect(gamesRepo.writePopularity.mock.calls[0][0].scores).toEqual([
      { id: "g-a", score: 0.7 / 1.05 }, { id: "g-b", score: null }, { id: "g-c", score: null },
    ]);
  });

  it("dates each score from its own oldest contributing observation", async () => {
    igdb.listPopularity.mockResolvedValue([
      { igdbId: 1, popularityType: 1, value: 100, calculatedAt: at("2026-11-01T23:00:00Z") },
      { igdbId: 1, popularityType: 3, value: 10, calculatedAt: at("2026-10-31T00:00:00Z") },
      { igdbId: 2, popularityType: 1, value: 50, calculatedAt: at("2026-11-01T23:00:00Z") },
    ]);
    await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0].sourceDates).toEqual([
      { id: "g-a", calculatedAt: at("2026-10-31T00:00:00Z") },
      { id: "g-b", calculatedAt: at("2026-11-01T23:00:00Z") },
      { id: "g-c", calculatedAt: null },
    ]);
  });

  it("fails without replacing the last good chart when every observation is stale or undated", async () => {
    igdb.listPopularity.mockResolvedValue([
      { igdbId: 1, popularityType: 1, value: 100, calculatedAt: at("2026-10-01T00:00:00Z") },
      { igdbId: 2, popularityType: 5, value: 100, calculatedAt: null },
    ]);
    await expect(handler.handle()).rejects.toThrow("existing scores were kept");
    expect(discovery.discover).not.toHaveBeenCalled();
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
  });

  it("keeps stored scores if the provider fails before completing pagination", async () => {
    igdb.listPopularity.mockRejectedValue(new Error("provider page failed"));
    await expect(handler.handle()).rejects.toThrow("provider page failed");
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("preserves real zero measurements while leaving missing current data unknown", async () => {
    igdb.listPopularity.mockResolvedValue([{ igdbId: 1, popularityType: 1, value: 0, calculatedAt: at("2026-11-01T00:00:00Z") }]);
    await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0].scores).toEqual([
      { id: "g-a", score: 0 }, { id: "g-b", score: null }, { id: "g-c", score: null },
    ]);
  });

  it("discovers missing leaders through the canonical importer before scoring them", async () => {
    const importer = { importPage: vi.fn().mockResolvedValue([{ status: "created" }]) };
    igdb.listGamesByIds = vi.fn().mockResolvedValue([{ igdbId: 999, title: "New remake" }]);
    importer.importPage.mockImplementation(async () => {
      const sources = await gamesRepo.listPopularitySources();
      sources.push({ id: "new", igdbId: 999, popularityScore: null, gameModeIds: [1] });
      return [{ status: "created" }];
    });
    const realDiscovery = new PopularityDiscoveryService(igdb as unknown as IIgdbClient, importer as unknown as ImportGameHandler);
    handler = new RefreshPopularityHandler(gamesRepo as unknown as IGamesRepository, igdb as unknown as IIgdbClient,
      eventBus as unknown as IEventBus, ownerRanking as unknown as OwnerRankingService, realDiscovery);
    const result = await handler.handle();
    expect(igdb.listGamesByIds).toHaveBeenCalledWith([999], expect.any(AbortSignal));
    expect(importer.importPage).toHaveBeenCalledWith([{ igdbId: 999, title: "New remake" }]);
    expect(result.discoveredCount).toBe(1);
    expect(gamesRepo.writePopularity.mock.calls[0][0].scores).toContainEqual({ id: "new", score: 0.7 });
  });

  it("bounds discovery to current leaders and never reimports known identities", async () => {
    const primitives = Array.from({ length: 400 }, (_, i) => ({ igdbId: i + 1, popularityType: 1, value: 500 - i, calculatedAt: at("2026-11-01T00:00:00Z") }));
    igdb.listPopularity.mockResolvedValue(primitives);
    igdb.listGamesByIds = vi.fn().mockResolvedValue([]);
    const importer = { importPage: vi.fn() };
    const realDiscovery = new PopularityDiscoveryService(igdb as unknown as IIgdbClient, importer as unknown as ImportGameHandler);
    handler = new RefreshPopularityHandler(gamesRepo as unknown as IGamesRepository, igdb as unknown as IIgdbClient,
      eventBus as unknown as IEventBus, ownerRanking as unknown as OwnerRankingService, realDiscovery);
    await handler.handle();
    const ids = igdb.listGamesByIds.mock.calls[0][0];
    expect(ids).toHaveLength(197);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(201);
    expect(importer.importPage).not.toHaveBeenCalled();
  });

  it("keeps scores intact when discovery fails and retries discovery on the next run", async () => {
    discovery.discover.mockRejectedValueOnce(new Error("hydration unavailable"));
    await expect(handler.handle()).rejects.toThrow("hydration unavailable");
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    await handler.handle();
    expect(discovery.discover).toHaveBeenCalledTimes(2);
    expect(gamesRepo.writePopularity).toHaveBeenCalledTimes(1);
  });

  it("normalizes against leaders outside the local catalog", async () => {
    igdb.listPopularity.mockResolvedValue([
      { igdbId: 999, popularityType: 1, value: 100_000, calculatedAt: at("2026-11-01T00:00:00Z") },
      { igdbId: 1, popularityType: 1, value: 10, calculatedAt: at("2026-11-01T00:00:00Z") },
    ]);
    await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0].scores[0].score).toBeCloseTo(0.7 * 0.01 / 1.05);
  });

  it("propagates strict indexing failure and repairs unchanged persisted scores on a rerun", async () => {
    eventBus.publish.mockRejectedValueOnce(new Error("search unavailable"));
    await expect(handler.handle({ requireSearchSync: true })).rejects.toThrow("search unavailable");
    const persisted = gamesRepo.writePopularity.mock.calls[0][0].scores;
    const sources = await gamesRepo.listPopularitySources();
    sources.forEach((source: any) => { source.popularityScore = persisted.find((score: any) => score.id === source.id).score; });
    await handler.handle({ requireSearchSync: true });
    expect(eventBus.publish).toHaveBeenLastCalledWith(expect.objectContaining({ gameIds: ["g-a", "g-b", "g-c"], requireSearchSync: true }), { throwOnError: true });
  });
});
