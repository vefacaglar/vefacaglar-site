import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { gameCardFromDoc, POPULARITY_UNKNOWN, type GameDoc } from "./game.mapper";

describe("gameCardFromDoc", () => {
  const doc = { id: "a", slug: "a", title: "A" } as GameDoc;

  it("exposes indexed popularity and HLTB hours to public cards", () => {
    expect(gameCardFromDoc({ ...doc, popularityScore: 0.8, hltbMainHours: "20.0", hltbMainExtraHours: "30.5", hltbCompletionistHours: "45" }))
      .toMatchObject({ popularityScore: 0.8, hltbMainHours: "20.0", hltbMainExtraHours: "30.5", hltbCompletionistHours: "45" });
  });

  it("maps old or unknown indexed values to nullable public fields", () => {
    expect(gameCardFromDoc(doc)).toMatchObject({ popularityScore: null, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
    for (const popularityScore of [POPULARITY_UNKNOWN, Number.NaN, Number.POSITIVE_INFINITY, 2]) {
      expect(gameCardFromDoc({ ...doc, popularityScore }).popularityScore).toBeNull();
    }
    expect(gameCardFromDoc({ ...doc, popularityScore: 0 }).popularityScore).toBe(0);
  });
});
