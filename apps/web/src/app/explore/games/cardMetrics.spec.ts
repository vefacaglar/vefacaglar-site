import { describe, expect, it } from "vitest";
import { formatReviewScore, selectReviewScores } from "./cardMetrics";

describe("game card metrics", () => {
  it("returns the explicitly labelled IGDB aggregate score when valid", () => {
    expect(selectReviewScores({ criticScore: 92 })).toEqual([{ source: "IGDB Critics", value: 92 }]);
    expect(selectReviewScores({ criticScore: 0 })).toEqual([{ source: "IGDB Critics", value: 0 }]);
  });

  it("filters out invalid or missing critic scores", () => {
    expect(selectReviewScores({})).toEqual([]);
    expect(selectReviewScores({ criticScore: null })).toEqual([]);
    expect(selectReviewScores({ criticScore: -1 })).toEqual([]);
    expect(selectReviewScores({ criticScore: 101 })).toEqual([]);
    expect(selectReviewScores({ criticScore: Number.NaN })).toEqual([]);
    expect(selectReviewScores({ criticScore: "90" as any })).toEqual([]);
  });

  it("formats actual review scores without rescaling or forcing trailing zeros", () => {
    expect(formatReviewScore(87.5, "en")).toBe("87.5");
    expect(formatReviewScore(87.5, "tr")).toBe("87,5");
    expect(formatReviewScore(0, "en")).toBe("0");
    expect(formatReviewScore(100, "en")).toBe("100");
  });
});
