import { describe, it, expect } from "vitest";
import { localToday } from "./watchDate";
describe("localToday", () => {
  it("reads the local calendar components instead of a UTC ISO day", () => {
    const date = new Date(2026, 0, 2, 0, 5);
    expect(localToday(date)).toBe("2026-01-02");
  });
  it("pads single-digit months and days", () => { expect(localToday(new Date(2026, 8, 7))).toBe("2026-09-07"); });
});
