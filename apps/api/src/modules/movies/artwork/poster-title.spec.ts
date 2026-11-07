import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { hasConflictingSequelNumber } from "./poster-title";

describe("explicit sequel-title conflicts", () => {
  it("withholds only different standalone sequel numbers on the same title", () => {
    expect(hasConflictingSequelNumber("Jailer 3", "Jailer 2")).toBe(true);
    expect(hasConflictingSequelNumber(" JAILER 3 ", "Jailer 2 (2026 film)")).toBe(true);
    expect(hasConflictingSequelNumber("Jailer 2", "Jailer 2 (film)")).toBe(false);
    expect(hasConflictingSequelNumber("Jailer", "Jailer")).toBe(false);
  });
  it("does not infer sequels from release years, numeric-only names, embedded numbers or Roman numerals", () => {
    for (const [movie, article] of [["2001", "2010"], ["1917", "1918"], ["47 Ronin", "Ronin 2"],
      ["Blade Runner 2049", "Blade Runner 2029"], ["Room 237", "Room 238"], ["Se7en", "Seven"],
      ["Rocky III", "Rocky II"], ["Jailer 3", "Jailer 2 (2026)"]]) {
      expect(hasConflictingSequelNumber(movie, article)).toBe(false);
    }
  });
  it("does not fuzzy-match renamed or translated titles", () => {
    expect(hasConflictingSequelNumber("The Godfather Part 3", "The Godfather 2")).toBe(false);
    expect(hasConflictingSequelNumber("Le Parrain 3", "The Godfather 2")).toBe(false);
    expect(hasConflictingSequelNumber(null, "Jailer 2")).toBe(false);
  });
});
