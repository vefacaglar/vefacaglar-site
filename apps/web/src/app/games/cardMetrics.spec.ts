import { describe, expect, it } from "vitest";
import { formatHltbHours, formatPopularity } from "./cardMetrics";

describe("game card metrics", () => {
  it("formats a normalized popularity index on a 0–100 scale", () => {
    expect(formatPopularity(0.826, "en")).toBe("82.6");
    expect(formatPopularity(0.9997, "en")).toBe("99.97");
    expect(formatPopularity(0.9997, "tr")).toBe("99,97");
    expect(formatPopularity(0.98, "tr")).toBe("98");
    expect(formatPopularity(0, "en")).toBe("0");
    expect(formatPopularity(1, "en")).toBe("100");
  });

  it("hides missing or invalid popularity values", () => {
    expect(formatPopularity(null, "en")).toBeNull();
    expect(formatPopularity(undefined, "en")).toBeNull();
    expect(formatPopularity(NaN, "en")).toBeNull();
    expect(formatPopularity(1.1, "en")).toBeNull();
    expect(formatPopularity(-0.1, "en")).toBeNull();
  });

  it("formats actual HLTB hours and hides absent or unusable values", () => {
    expect(formatHltbHours("30.50", "en")).toBe("30.5");
    expect(formatHltbHours("30.50", "tr")).toBe("30,5");
    for (const value of [null, undefined, "", " ", "0", "0.001", "-2", "not a number", "Infinity"]) {
      expect(formatHltbHours(value, "en")).toBeNull();
    }
  });
});
