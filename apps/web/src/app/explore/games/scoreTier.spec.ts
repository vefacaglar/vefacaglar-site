import { describe, expect, it } from "vitest";
import { scoreTier } from "./scoreTier";

describe("scoreTier", () => {
  it("is 'high' from 90", () => {
    expect(scoreTier(90)).toBe("high");
    expect(scoreTier(100)).toBe("high");
  });

  it("is 'mid' from 75 up to 90", () => {
    expect(scoreTier(75)).toBe("mid");
    expect(scoreTier(89.9)).toBe("mid");
  });

  it("is 'low' below 75 and for unusable numbers", () => {
    expect(scoreTier(74.9)).toBe("low");
    expect(scoreTier(0)).toBe("low");
    expect(scoreTier(-5)).toBe("low");
    expect(scoreTier(NaN)).toBe("low");
  });
});
