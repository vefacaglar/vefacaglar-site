import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { playtimeIncrease } from "./playtime-delta";

describe("playtimeIncrease", () => {
  it("records the full playtime of a new log, with no previous value", () => {
    expect(playtimeIncrease(null, "12")).toEqual({ deltaHours: "12.0", previousHours: null, newHours: "12.0" });
  });

  it("records only the difference when playtime grows", () => {
    expect(playtimeIncrease("5.0", "8")).toEqual({ deltaHours: "3.0", previousHours: "5.0", newHours: "8.0" });
  });

  it("subtracts decimals without float drift", () => {
    expect(playtimeIncrease("5.1", "8.3")).toEqual({ deltaHours: "3.2", previousHours: "5.1", newHours: "8.3" });
  });

  it("treats a missing previous playtime as zero", () => {
    expect(playtimeIncrease(null, 2.5)).toEqual({ deltaHours: "2.5", previousHours: null, newHours: "2.5" });
  });

  it.each([
    ["unchanged", "8.0", "8"],
    ["decreased", "8.0", "5"],
    ["cleared", "8.0", null],
    ["still empty", null, null],
    ["zero on a new log", null, "0"],
  ])("returns null when playtime is %s", (_label, previous, next) => {
    expect(playtimeIncrease(previous, next)).toBeNull();
  });
});
