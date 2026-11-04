import { describe, expect, it } from "vitest";
import { getScoreColorClass } from "./scoreColor";

const styles = { scoreHigh: "high-class", scoreMid: "mid-class" };

describe("getScoreColorClass", () => {
  it("uses the high class from 90", () => {
    expect(getScoreColorClass(90, styles)).toBe("high-class");
    expect(getScoreColorClass(100, styles)).toBe("high-class");
  });

  it("uses the mid class from 75 up to 90", () => {
    expect(getScoreColorClass(75, styles)).toBe("mid-class");
    expect(getScoreColorClass(89, styles)).toBe("mid-class");
  });

  it("has no class below 75", () => {
    expect(getScoreColorClass(74, styles)).toBe("");
    expect(getScoreColorClass(1, styles)).toBe("");
  });

  it("has no class for null, 0 or NaN", () => {
    expect(getScoreColorClass(null, styles)).toBe("");
    expect(getScoreColorClass(0, styles)).toBe("");
    expect(getScoreColorClass(NaN, styles)).toBe("");
  });
});
