import { describe, it, expect } from "vitest";
import { sameHours, toHours } from "./hltb-types";
describe("HLTB edit-form values", () => {
  it("compares numeric duration values despite string formatting", () => {
    expect(sameHours({ mainHours: toHours("10.0"), mainExtraHours: toHours(""), completionistHours: toHours("12.5") }, { mainHours: 10, mainExtraHours: null, completionistHours: 12.5 })).toBe(true);
  });
  it("detects unsaved edits and preserves missing values", () => {
    expect(toHours(null)).toBeNull();
    expect(sameHours({ mainHours: 11, mainExtraHours: null, completionistHours: null }, { mainHours: 10, mainExtraHours: null, completionistHours: null })).toBe(false);
  });
});
