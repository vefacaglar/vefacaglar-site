import { describe, expect, it } from "vitest";
import { formatHltbHours, formatReviewScore, selectReviewScores } from "./cardMetrics";

describe("game card metrics", () => {
  it("keeps both real review providers without adding a duplicate IGDB aggregate", () => {
    expect(selectReviewScores({ metacriticScore: 87, openCriticScore: 89, criticScore: 95 })).toEqual([
      { source: "Metacritic", value: 87 },
      { source: "OpenCritic", value: 89 },
    ]);
  });

  it("uses the available provider and preserves a real zero", () => {
    expect(selectReviewScores({ metacriticScore: 0, criticScore: 90 })).toEqual([{ source: "Metacritic", value: 0 }]);
    expect(selectReviewScores({ openCriticScore: 81, criticScore: 90 })).toEqual([{ source: "OpenCritic", value: 81 }]);
  });

  it("falls back to the explicitly labelled IGDB aggregate only when neither provider is usable", () => {
    expect(selectReviewScores({ metacriticScore: null, criticScore: 92 })).toEqual([{ source: "IGDB Critics", value: 92 }]);
    expect(selectReviewScores({ metacriticScore: Number.NaN, openCriticScore: 101, criticScore: 0 })).toEqual([{ source: "IGDB Critics", value: 0 }]);
    expect(selectReviewScores({})).toEqual([]);
    expect(selectReviewScores({ metacriticScore: -1, openCriticScore: Infinity, criticScore: 101 })).toEqual([]);
    expect(selectReviewScores({ metacriticScore: "90" as any })).toEqual([]);
  });

  it("formats actual review scores without rescaling or forcing trailing zeros", () => {
    expect(formatReviewScore(87.5, "en")).toBe("87.5");
    expect(formatReviewScore(87.5, "tr")).toBe("87,5");
    expect(formatReviewScore(0, "en")).toBe("0");
    expect(formatReviewScore(100, "en")).toBe("100");
  });

  it("formats actual HLTB hours and hides absent or unusable values", () => {
    expect(formatHltbHours("30.50", "en")).toBe("30.5");
    expect(formatHltbHours("30.50", "tr")).toBe("30,5");
    for (const value of [null, undefined, "", " ", "0", "0.001", "-2", "not a number", "Infinity"]) {
      expect(formatHltbHours(value, "en")).toBeNull();
    }
  });
});
