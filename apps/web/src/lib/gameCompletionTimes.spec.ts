import { describe, it, expect } from "vitest";
import { compactCompletionTime, formatCompletionDuration, compactCompletionEstimate, compactIndependentCompletion } from "./gameCompletionTimes";

describe("game completion duration presentation", () => {
  it("formats short games and hours without confusing seconds with hours", () => {
    expect(formatCompletionDuration(30)).toBe("<1 min");
    expect(formatCompletionDuration(2700)).toBe("45 min");
    expect(formatCompletionDuration(5400)).toBe("1.5 h");
  });
  it("labels available categories honestly", () => {
    const times = { creditsSeconds: null, extrasSeconds: 7200, completionistSeconds: 10800, sampleCount: 1, source: "IGDB" as const, updatedAt: null };
    expect(compactCompletionTime(times)).toBe("2 h reported with extras");
    expect(compactCompletionTime({ ...times, creditsSeconds: 3600 })).toBe("1 h reported to credits");
    expect(compactCompletionTime(null)).toBeNull();
  });
});

 describe("mixed source presentation", () => {
  it("renders the API consensus estimate and source range without recomputing a raw mean", () => {
    expect(compactCompletionEstimate({ kind: "agreement", estimateSeconds: 32 * 3600, lowerSeconds: 30 * 3600,
      upperSeconds: 34 * 3600, providers: ["backloggd", "ifdb"], excludedProviders: ["igdb"] }))
      .toBe("32 h reported finish");
    expect(compactCompletionEstimate({ kind: "range", estimateSeconds: null, lowerSeconds: 44 * 3600,
      upperSeconds: 115 * 3600, providers: ["backloggd", "igdb"], excludedProviders: [] }))
      .toBe("44 h–115 h reported range");
  });
  it("labels VNDB play time separately from a finish estimate", () => {
    expect(compactIndependentCompletion([{ provider: "vndb", sourceUrl: "https://vndb.org/v1", scope: "VN entry", statistic: "average_playtime",
      finishSeconds: null, masterSeconds: null, playtimeSeconds: 7200, sampleCount: 10, fetchedAt: "2026-11-22", sourceUpdatedAt: null }]))
      .toBe("2 h average play time");
  });
});
