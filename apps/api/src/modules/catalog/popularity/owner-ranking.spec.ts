import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ownerRankingBreakdown } from "./owner-ranking";
import type { OwnerRankingSource } from "./owner-ranking.types";

const source = (patch: Partial<OwnerRankingSource> = {}): OwnerRankingSource => ({
  id: "game", hasAction: false, hasRpg: false, hasOpenWorld: false,
  gameModeIds: null, popularityScore: null, recommendationScore: null, ...patch,
});

describe("ownerRankingBreakdown", () => {
  it("prefers an action/open-world/single-player RPG over a more popular multiplayer game", () => {
    const preferred = ownerRankingBreakdown(source({ hasAction: true, hasRpg: true, hasOpenWorld: true, gameModeIds: [1], popularityScore: 0.5 }));
    const popular = ownerRankingBreakdown(source({ hasAction: true, gameModeIds: [2, 5], popularityScore: 1 }));
    expect(preferred.score).toBeCloseTo(0.825);
    expect(popular.score).toBeCloseTo(0.35);
    expect(preferred.score).toBeGreaterThan(popular.score);
  });

  it("adds individual affinities without requiring every preferred tag", () => {
    const rpg = ownerRankingBreakdown(source({ hasRpg: true }));
    expect(rpg.affinityScore).toBe(0.25);
    expect(rpg.score).toBeCloseTo(0.1625);
    expect(rpg.affinityContributions.preferredCombination).toBe(0);
  });

  it("does not infer single-player or multiplayer-only from unknown, empty or future modes", () => {
    for (const gameModeIds of [null, [], [99]]) {
      const result = ownerRankingBreakdown(source({ hasRpg: true, gameModeIds }));
      expect(result.affinityContributions.singlePlayer).toBe(0);
      expect(result.affinityContributions.multiplayerOnlyPenalty).toBe(0);
    }
  });

  it("accepts single-player alongside co-op without a multiplayer penalty", () => {
    const result = ownerRankingBreakdown(source({ hasRpg: true, hasOpenWorld: true, gameModeIds: [1, 3] }));
    expect(result.affinityContributions.singlePlayer).toBe(0.2);
    expect(result.affinityContributions.preferredCombination).toBe(0.15);
    expect(result.affinityContributions.multiplayerOnlyPenalty).toBe(0);
  });

  it("uses interest alone when taste metadata is unknown and preserves measured zero", () => {
    expect(ownerRankingBreakdown(source({ popularityScore: 0.8 })).score).toBeCloseTo(0.28);
    expect(ownerRankingBreakdown(source({ popularityScore: 0 })).interestScore).toBe(0);
    expect(ownerRankingBreakdown(source()).interestScore).toBeNull();
  });

  it("stays finite and bounded for absent or invalid source scores", () => {
    for (const popularityScore of [null, NaN, Infinity, -100, 100]) {
      const result = ownerRankingBreakdown(source({ popularityScore, hasRpg: true }));
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it("does not incorporate HLTB duration, engagement or private ratings into ranking", () => {
    const original = source({ popularityScore: 0.5 });
    const extra = { ...original, hltb: { completed: 1e12, mainHours: 200 }, userRating: 100 };
    expect(ownerRankingBreakdown(extra)).toEqual(ownerRankingBreakdown(original));
  });
});
