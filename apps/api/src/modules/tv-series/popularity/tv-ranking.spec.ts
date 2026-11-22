import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { tvRankingMetadata } from "./tv-ranking";
const source = { provider: "tmdb", sourceDate: "2026-11-22", windowStart: "2026-11-22", expiresAt: "2026-11-25T00:00:00Z", sourceUrl: "https://files.tmdb.org/" };
describe("TV current popularity metadata", () => {
  it("labels only complete fresh source metadata current", () => {
    expect(tvRankingMetadata([source], new Date("2026-11-22T12:00:00Z"))).toMatchObject({ isFresh: true, mode: "current_popularity" });
    expect(tvRankingMetadata([source], new Date("2026-11-25T00:00:00Z")).mode).toBe("alphabetical");
  });
  it("rejects missing, future and partially malformed publications", () => {
    expect(tvRankingMetadata([]).isFresh).toBe(false);
    expect(tvRankingMetadata([source], new Date("2026-11-21T00:00:00Z")).isFresh).toBe(false);
    expect(tvRankingMetadata([source, { broken: true }], new Date("2026-11-22T12:00:00Z")).isFresh).toBe(false);
  });
});
