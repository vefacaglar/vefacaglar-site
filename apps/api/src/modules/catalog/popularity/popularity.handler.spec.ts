import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OwnerRankingService } from "./owner-ranking.service";
import { RefreshPopularityHandler } from "./popularity.handler";
import { computePopularityScores, percentileRanks, type PopularityInput } from "./popularity-score";
import type { IGamesRepository } from "../games.repository.interface";
import type { IHltbClient, IIgdbClient } from "../import/import.types";
import type { IEventBus } from "../../../shared/events/event-bus";

const at = (iso: string) => new Date(iso);

describe("percentileRanks", () => {
  it("ranks values in input order and gives ties their shared mid-rank", () => {
    expect(percentileRanks([30, 10, 20])).toEqual([1, 0, 0.5]);
    expect(percentileRanks([5, 5, 1])).toEqual([0.75, 0.75, 0]);
    expect(percentileRanks([42])).toEqual([1]);
    expect(percentileRanks([])).toEqual([]);
  });
});

describe("computePopularityScores", () => {
  it("does not invent current interest from historical ratings, reviews or HLTB completions", () => {
    const scores = computePopularityScores([
      { id: "historical", signals: { played: 10_000_000, steamReviews: 5_000_000, ratingCount: 1_000_000, hltbEngagement: 100_000_000 } } as unknown as PopularityInput,
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
    expect(scores.get("current")).toBeCloseTo(0.7);
    expect(scores.get("other")).toBeCloseTo(0.3);
  });

  it("ranks recent interest above an older game with enormous lifetime counters", () => {
    const scores = computePopularityScores([
      { id: "old", signals: { visits: 1, playing: 1, steam24hPeak: 1, played: 1e9, ratingCount: 1e9, hltbEngagement: 1e9 } } as unknown as PopularityInput,
      { id: "recent", signals: { visits: 100, playing: 10, steam24hPeak: 10 } },
    ]);
    expect(scores.get("recent")).toBe(1);
    expect(scores.get("old")).toBe(0);
  });

  it("reweights missing current signals instead of treating them as zero", () => {
    const scores = computePopularityScores([
      { id: "visits", signals: { visits: 500 } },
      { id: "both", signals: { visits: 100, playing: 10 } },
      { id: "playing", signals: { playing: 1000 } },
    ]);
    expect(scores.get("visits")).toBe(1);
    expect(scores.get("both")).toBe(0);
    expect(scores.get("playing")).toBe(1);
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
    expect(scores.get("valid")).toBe(1);
  });
});

describe("RefreshPopularityHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let eventBus: Record<keyof IEventBus, any>;
  let hltb: Record<keyof IHltbClient, any>;
  let handler: RefreshPopularityHandler;
  let ownerRanking: { backfillGameModes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    gamesRepo = {
      listPopularitySources: vi.fn().mockResolvedValue([
        { id: "g-a", igdbId: 1, title: "Game A", originalTitle: null, releaseDate: "2020-01-01", hltb: null, igdbRatingCount: 100, popularityScore: null },
        { id: "g-b", igdbId: 2, title: "Game B", originalTitle: null, releaseDate: null, hltb: null, igdbRatingCount: 10, popularityScore: 0.5 },
        { id: "g-c", igdbId: 3, title: "Game C", originalTitle: null, releaseDate: null, hltb: null, igdbRatingCount: 100_000_000, popularityScore: null },
      ]),
      writePopularity: vi.fn().mockResolvedValue(undefined),
    } as unknown as Record<keyof IGamesRepository, any>;
    igdb = {
      findGame: vi.fn(), listGames: vi.fn(),
      listPopularity: vi.fn().mockResolvedValue([
        { igdbId: 999, popularityType: 1, value: 50_000, calculatedAt: null },
        { igdbId: 1, popularityType: 1, value: 1000, calculatedAt: at("2026-11-01T00:00:00Z") },
        { igdbId: 2, popularityType: 1, value: 10, calculatedAt: at("2026-11-01T00:00:00Z") },
        { igdbId: 2, popularityType: 1, value: 99_999, calculatedAt: at("2026-10-01T00:00:00Z") },
        { igdbId: 3, popularityType: 4, value: 1e9, calculatedAt: null },
      ]),
    };
    eventBus = { publish: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn() };
    hltb = { searchCandidates: vi.fn(), findTimes: vi.fn(), listPopular: vi.fn().mockResolvedValue([]) };
    ownerRanking = { backfillGameModes: vi.fn().mockResolvedValue({ checkedCount: 0, status: "complete" }) };
    handler = new RefreshPopularityHandler(gamesRepo as unknown as IGamesRepository, igdb as unknown as IIgdbClient,
      eventBus as unknown as IEventBus, hltb as unknown as IHltbClient, ownerRanking as unknown as OwnerRankingService);
  });


  it("writes versioned taste scores from refreshed interest and verified metadata", async () => {
    const sources = await gamesRepo.listPopularitySources();
    Object.assign(sources[0], { hasAction: true, hasRpg: true, hasOpenWorld: true, gameModeIds: [1] });
    Object.assign(sources[1], { hasAction: true, hasRpg: false, hasOpenWorld: false, gameModeIds: [2] });
    ownerRanking.backfillGameModes.mockResolvedValue({ checkedCount: 500, status: "budget" });
    const result = await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0]).toMatchObject({
      recommendationVersion: "owner-taste-v1",
      recommendationScores: [{ id: "g-a", score: 1 }, { id: "g-b", score: 0 }, { id: "g-c", score: 0 }],
    });
    expect(result).toMatchObject({ recommendationScoredCount: 3, gameModesCheckedCount: 500, gameModesStatus: "budget" });
  });

  it("reindexes a changed taste score even when current interest is unchanged", async () => {
    const sources = await gamesRepo.listPopularitySources();
    Object.assign(sources[0], { popularityScore: 1, recommendationScore: 0.35, hasRpg: true, gameModeIds: [1] });
    Object.assign(sources[1], { popularityScore: 0, recommendationScore: 0 });
    Object.assign(sources[2], { popularityScore: null, recommendationScore: 0 });
    await handler.handle();
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ gameIds: ["g-a"] }), { throwOnError: undefined });
  });

  it("keeps unknown mode metadata usable when optional mode hydration is unavailable", async () => {
    ownerRanking.backfillGameModes.mockResolvedValue({ checkedCount: 0, status: "unavailable" });
    const result = await handler.handle();
    expect(result.gameModesStatus).toBe("unavailable");
    expect(gamesRepo.writePopularity.mock.calls[0][0].recommendationScores[0]).toEqual({ id: "g-a", score: 0.35 });
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
    expect(write.scores).toEqual([{ id: "g-a", score: 1 }, { id: "g-b", score: 0 }, { id: "g-c", score: null }]);
  });

  it("reindexes changed games and reports counts", async () => {
    const result = await handler.handle();
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "games.imported", gameIds: ["g-a", "g-b", "g-c"] }), { throwOnError: undefined });
    expect(result).toMatchObject({ gameCount: 3, signalCount: 2, scoredCount: 2, reindexedCount: 3 });
  });

  it("does not fetch or write for an empty catalog", async () => {
    gamesRepo.listPopularitySources.mockResolvedValue([]);
    const result = await handler.handle();
    expect(result).toMatchObject({ gameCount: 0, signalCount: 0, scoredCount: 0, reindexedCount: 0 });
    expect(igdb.listPopularity).not.toHaveBeenCalled();
    expect(hltb.listPopular).not.toHaveBeenCalled();
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [{ igdbId: 999, popularityType: 1, value: 100, calculatedAt: null }],
    [{ igdbId: 1, popularityType: 1, value: Number.NaN, calculatedAt: null }],
    [{ igdbId: 1, popularityType: 1, value: -1, calculatedAt: null }],
    [{ igdbId: 1, popularityType: 4, value: 100, calculatedAt: null }],
  ].map((primitives) => ({ primitives })))("keeps existing scores when no applicable current provider data exists ($primitives)", async ({ primitives }) => {
    igdb.listPopularity.mockResolvedValue(primitives);
    await expect(handler.handle()).rejects.toThrow("existing scores were kept");
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(hltb.listPopular).not.toHaveBeenCalled();
  });

  it("keeps stored scores if the provider fails before completing pagination", async () => {
    igdb.listPopularity.mockRejectedValue(new Error("provider page failed"));
    await expect(handler.handle()).rejects.toThrow("provider page failed");
    expect(gamesRepo.writePopularity).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("preserves real zero measurements while leaving missing current data unknown", async () => {
    igdb.listPopularity.mockResolvedValue([{ igdbId: 1, popularityType: 1, value: 0, calculatedAt: null }]);
    await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0].scores).toEqual([
      { id: "g-a", score: 0 }, { id: "g-b", score: null }, { id: "g-c", score: null },
    ]);
  });

  it("stores HLTB engagement and completion hours independently of the trend score", async () => {
    hltb.listPopular.mockResolvedValue([{
      hltbId: 103, title: "Game C", releaseYear: null, completed: 100_000_000, backlog: 100_000_000, playing: 100_000_000,
      times: { mainHours: 20, mainExtraHours: null, completionistHours: 35 },
    }]);
    const result = await handler.handle();
    const write = gamesRepo.writePopularity.mock.calls[0][0];
    expect(result).toMatchObject({ hltbStatus: "updated", hltbFetchedCount: 1, hltbMatchedCount: 1 });
    expect(write.hltbUpdates).toEqual([expect.objectContaining({ gameId: "g-c", hltbId: 103, completed: 100_000_000,
      times: { mainHours: 20, mainExtraHours: null, completionistHours: 35 } })]);
    expect(write.scores[2]).toEqual({ id: "g-c", score: null });
  });

  it("retains HLTB snapshots on optional provider failure without affecting current scores", async () => {
    const sources = await gamesRepo.listPopularitySources();
    sources[2].hltb = { hltbId: 103, completed: 1e9, backlog: 1e9, playing: 1e9, updatedAt: new Date() };
    hltb.listPopular.mockRejectedValue(new Error("private provider session details"));
    const result = await handler.handle();
    const write = gamesRepo.writePopularity.mock.calls[0][0];
    expect(result.hltbStatus).toBe("unavailable");
    expect(write.hltbUpdates).toEqual([]);
    expect(write.scores[2]).toEqual({ id: "g-c", score: null });
  });

  it("preserves last good HLTB counts when a response omits them", async () => {
    const sources = await gamesRepo.listPopularitySources();
    sources[0].hltb = { hltbId: 101, completed: 900, backlog: 20, playing: 10, updatedAt: at("2026-10-01T00:00:00Z") };
    hltb.listPopular.mockResolvedValue([{
      hltbId: 101, title: "Game A", releaseYear: 2020, completed: null, backlog: 0, playing: null,
      times: { mainHours: null, mainExtraHours: null, completionistHours: null },
    }]);
    await handler.handle();
    expect(gamesRepo.writePopularity.mock.calls[0][0].hltbUpdates[0]).toMatchObject({ completed: 900, backlog: 0, playing: 10 });
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
