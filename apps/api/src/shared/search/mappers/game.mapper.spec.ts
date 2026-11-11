import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { gameCardFromDoc, POPULARITY_UNKNOWN, type GameDoc } from "./game.mapper";

describe("gameCardFromDoc", () => {
  const doc = { id: "a", slug: "a", title: "A" } as GameDoc;

  it("exposes indexed popularity while suppressing stored completion hours on public cards", () => {
    expect(gameCardFromDoc({ ...doc, popularityScore: 0.8, hltbMainHours: "20.0", hltbMainExtraHours: "30.5", hltbCompletionistHours: "45" }))
      .toMatchObject({ popularityScore: 0.8, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
  });

  it("maps old or unknown indexed values to nullable public fields", () => {
    expect(gameCardFromDoc(doc)).toMatchObject({ metacriticScore: null, openCriticScore: null, popularityScore: null, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
    for (const popularityScore of [POPULARITY_UNKNOWN, Number.NaN, Number.POSITIVE_INFINITY, 2]) {
      expect(gameCardFromDoc({ ...doc, popularityScore }).popularityScore).toBeNull();
    }
    expect(gameCardFromDoc({ ...doc, popularityScore: 0 }).popularityScore).toBe(0);
  });

  it("suppresses indexed Metacritic and OpenCritic values while preserving IGDB criticScore", () => {
    expect(gameCardFromDoc({ ...doc, metacriticScore: 88, openCriticScore: 89, criticScore: 91, criticScoreCount: 12 }))
      .toMatchObject({ metacriticScore: null, openCriticScore: null, criticScore: 91, criticScoreCount: 12 });
  });

  it("suppresses stored coverImageUrl on public search cards", () => {
    expect(gameCardFromDoc({ ...doc, coverImageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg" }).coverImageUrl).toBeNull();
  });
});
