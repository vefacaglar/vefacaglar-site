import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { completionConsensus } from "./completion-consensus";
import { publicCompletionSummary, publicCompletionMasterSummary } from "./completion-public";

const hours = (...values: number[]) => values.map((value, index) => ({ provider: `p${index}`, seconds: value * 3600 }));

describe("independent completion consensus", () => {
  it("averages an agreeing majority and excludes a materially different source", () => {
    expect(completionConsensus(hours(30, 34, 115))).toEqual({ kind: "agreement", estimateSeconds: 32 * 3600,
      lowerSeconds: 30 * 3600, upperSeconds: 34 * 3600, providers: ["p0", "p1"], excludedProviders: ["p2"] });
  });
  it("keeps two divergent reports as a range", () => {
    expect(completionConsensus(hours(30, 100))).toMatchObject({ kind: "range", estimateSeconds: null, lowerSeconds: 108000, upperSeconds: 360000 });
  });
  it("averages a close pair and allows small absolute rounding noise", () => {
    expect(completionConsensus(hours(30, 34))).toMatchObject({ kind: "agreement", estimateSeconds: 115200 });
    expect(completionConsensus([{ provider: "a", seconds: 2700 }, { provider: "b", seconds: 3000 }]))
      .toMatchObject({ kind: "agreement", estimateSeconds: 2850 });
  });
  it("keeps materially different short-game reports separate", () => {
    expect(completionConsensus([{ provider: "a", seconds: 120 }, { provider: "b", seconds: 900 }])?.kind).toBe("range");
  });
  it("refuses tied camps and a non-transitive agreement chain", () => {
    expect(completionConsensus(hours(30, 34, 100, 110))?.kind).toBe("range");
    expect(completionConsensus(hours(30, 35, 41))?.kind).toBe("range");
    expect(completionConsensus(hours(30, 34, 80, 140))?.kind).toBe("range");
  });
  it("supports a strict majority among four or more providers", () => {
    expect(completionConsensus(hours(30, 31, 34, 115))).toMatchObject({ kind: "agreement", estimateSeconds: 114000, excludedProviders: ["p3"] });
  });
  it("counts a provider once and excludes conflicting duplicate votes", () => {
    const a = { provider: "a", seconds: 108000 };
    expect(completionConsensus([a, a, { provider: "b", seconds: 360000 }])?.kind).toBe("range");
    expect(completionConsensus([a, { provider: "a", seconds: 360000 }, { provider: "b", seconds: 120000 }]))
      .toMatchObject({ kind: "single", providers: ["b"], estimateSeconds: 120000 });
  });
  it("rejects zero, missing and invalid observations", () => {
    expect(completionConsensus([{ provider: "a", seconds: 0 }, { provider: "b", seconds: NaN }, { provider: "", seconds: 1200 }])).toBeNull();
    expect(completionConsensus([])).toBeNull();
  });
  it("is invariant to source order", () => {
    for (const values of [hours(30, 34, 115), hours(30, 35, 41), hours(30, 34, 100, 110)]) {
      const expected = completionConsensus(values);
      for (let offset = 0; offset < values.length; offset++) {
        expect(completionConsensus([...values.slice(offset), ...values.slice(0, offset)].reverse())).toEqual(expected);
      }
    }
  });
  it("keeps average play time and mastery out of finish votes", () => {
    const igdb = { hastilySeconds: 115 * 3600, normallySeconds: null, completelySeconds: 500 * 3600, sampleCount: 73, sourceUpdatedAt: null };
    const report = { provider: "vndb" as const, sourceUrl: "https://vndb.org/v1", scope: "VN entry", statistic: "average_playtime" as const,
      finishSeconds: null, masterSeconds: null, playtimeSeconds: 30 * 3600, sampleCount: 100, sourceUpdatedAt: null, fetchedAt: "2026-11-22T00:00:00Z" };
    expect(publicCompletionSummary(igdb, [report])).toMatchObject({ kind: "single", estimateSeconds: 115 * 3600 });
    expect(publicCompletionMasterSummary(igdb, [report])).toMatchObject({ kind: "single", estimateSeconds: 500 * 3600 });
  });
});
