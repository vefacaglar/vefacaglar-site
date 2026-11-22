import { describe, it, expect } from "vitest";
import { compactCompletionTime, formatCompletionDuration } from "./gameCompletionTimes";

describe("game completion duration presentation", () => {
  it("formats short games and hours without confusing seconds with hours", () => {
    expect(formatCompletionDuration(30)).toBe("<1 min");
    expect(formatCompletionDuration(2700)).toBe("45 min");
    expect(formatCompletionDuration(5400)).toBe("1.5 h");
  });
  it("labels available categories honestly", () => {
    const times = { creditsSeconds: null, extrasSeconds: 7200, completionistSeconds: 10800, sampleCount: 1, source: "IGDB" as const, updatedAt: null };
    expect(compactCompletionTime(times)).toBe("2 h with extras · IGDB");
    expect(compactCompletionTime({ ...times, creditsSeconds: 3600 })).toBe("1 h to credits · IGDB");
    expect(compactCompletionTime(null)).toBeNull();
  });
});
