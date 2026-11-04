import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefreshPopularityHandler } from "./popularity.handler";
import { computePopularityScores, percentileRanks } from "./popularity-score";
import type { IGamesRepository } from "../games.repository.interface";
import type { IIgdbClient } from "../import/import.types";
import type { IEventBus } from "../../../shared/events/event-bus";

const at = (iso: string) => new Date(iso);

describe("percentileRanks", () => {
  it("ranks values 0-1 in input order and gives ties their shared mid-rank", () => {
    expect(percentileRanks([30, 10, 20])).toEqual([1, 0, 0.5]);
    expect(percentileRanks([5, 5, 1])).toEqual([0.75, 0.75, 0]);
  });

  it("ranks a single value 1 and an empty list as empty", () => {
    expect(percentileRanks([42])).toEqual([1]);
    expect(percentileRanks([])).toEqual([]);
  });
});

describe("computePopularityScores", () => {
  it("gives a game with no signals a null score", () => {
    const scores = computePopularityScores([{ id: "a", signals: {} }, { id: "b", signals: { played: null } }]);

    expect(scores.get("a")).toBeNull();
    expect(scores.get("b")).toBeNull();
  });

  it("re-weights over the signals a game has instead of treating missing ones as 0", () => {
    const scores = computePopularityScores([
      // Top in the only signal it has, so it scores 1 rather than being dragged down by missing ones.
      { id: "a", signals: { wantToPlay: 500 } },
      { id: "b", signals: { wantToPlay: 100, played: 10 } },
      { id: "c", signals: { played: 1000 } },
    ]);

    expect(scores.get("a")).toBe(1);
    // b: wantToPlay rank 0 (w 0.15), played rank 0 (w 0.35) -> 0.
    expect(scores.get("b")).toBe(0);
    expect(scores.get("c")).toBe(1);
  });

  it("blends ranks with the configured weights", () => {
    const scores = computePopularityScores([
      { id: "a", signals: { played: 100, steamReviews: 1, ratingCount: 50, wantToPlay: 7 } },
      { id: "b", signals: { played: 10, steamReviews: 9, ratingCount: 5, wantToPlay: 3 } },
    ]);

    // a wins played (0.35), ratingCount (0.25) and wantToPlay (0.15); b wins steamReviews (0.25).
    expect(scores.get("a")).toBeCloseTo(0.75);
    expect(scores.get("b")).toBeCloseTo(0.25);
  });

  it("counts a present zero as a real value, ranked below higher ones", () => {
    const scores = computePopularityScores([
      { id: "zero", signals: { ratingCount: 0 } },
      { id: "some", signals: { ratingCount: 3 } },
    ]);

    expect(scores.get("zero")).toBe(0);
    expect(scores.get("some")).toBe(1);
  });
});

describe("RefreshPopularityHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let eventBus: Record<keyof IEventBus, any>;
  let handler: RefreshPopularityHandler;

  beforeEach(() => {
    gamesRepo = {
      listPopularitySources: vi.fn().mockResolvedValue([
        { id: "g-a", igdbId: 1, igdbRatingCount: 100, popularityScore: null },
        { id: "g-b", igdbId: 2, igdbRatingCount: 10, popularityScore: 0.5 },
        { id: "g-c", igdbId: 3, igdbRatingCount: null, popularityScore: null },
      ]),
      writePopularity: vi.fn().mockResolvedValue(undefined),
    } as unknown as Record<keyof IGamesRepository, any>;
    igdb = {
      findGame: vi.fn(),
      listGames: vi.fn(),
      listPopularity: vi.fn().mockResolvedValue([
        { igdbId: 1, popularityType: 4, value: 1000, calculatedAt: at("2026-11-01T00:00:00Z") },
        { igdbId: 2, popularityType: 4, value: 10, calculatedAt: at("2026-11-01T00:00:00Z") },
        // An older duplicate is ignored in favour of the latest calculation.
        { igdbId: 2, popularityType: 4, value: 99999, calculatedAt: at("2026-10-01T00:00:00Z") },
        // Not in the catalog.
        { igdbId: 999, popularityType: 4, value: 5, calculatedAt: null },
      ]),
    };
    eventBus = { publish: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn() };
    handler = new RefreshPopularityHandler(
      gamesRepo as unknown as IGamesRepository,
      igdb as unknown as IIgdbClient,
      eventBus as unknown as IEventBus
    );
  });

  it("fetches Want to Play, Played and Steam Total Reviews for every IGDB-linked game", async () => {
    await handler.handle();

    expect(igdb.listPopularity).toHaveBeenCalledWith([1, 2, 3], [2, 4, 8]);
  });

  it("replaces the stored signals and writes every game's score", async () => {
    await handler.handle();

    expect(gamesRepo.writePopularity).toHaveBeenCalledTimes(1);
    const write = gamesRepo.writePopularity.mock.calls[0][0];
    expect(write.popularityTypes).toEqual([2, 4, 8]);
    expect(write.signals).toEqual([
      { gameId: "g-a", popularityType: 4, value: 1000, calculatedAt: at("2026-11-01T00:00:00Z") },
      { gameId: "g-b", popularityType: 4, value: 10, calculatedAt: at("2026-11-01T00:00:00Z") },
    ]);
    // g-a tops played and ratingCount, g-b is last in both, g-c has no signals at all.
    expect(write.scores).toEqual([
      { id: "g-a", score: 1 },
      { id: "g-b", score: 0 },
      { id: "g-c", score: null },
    ]);
    expect(write.updatedAt).toBeInstanceOf(Date);
  });

  it("reindexes only the games whose score changed and reports counts", async () => {
    const result = await handler.handle();

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "games.imported", gameIds: ["g-a", "g-b"] })
    );
    expect(result).toMatchObject({ gameCount: 3, signalCount: 2, scoredCount: 2, reindexedCount: 2 });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("does nothing harmful for an empty catalog", async () => {
    gamesRepo.listPopularitySources.mockResolvedValue([]);
    igdb.listPopularity.mockResolvedValue([]);

    const result = await handler.handle();

    expect(gamesRepo.writePopularity).toHaveBeenCalledWith(expect.objectContaining({ signals: [], scores: [] }));
    expect(result).toMatchObject({ gameCount: 0, signalCount: 0, scoredCount: 0, reindexedCount: 0 });
  });
});
