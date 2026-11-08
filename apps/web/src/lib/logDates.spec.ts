import { describe, expect, it } from "vitest";
import { istanbulToday, isAllowedLogDate } from "./logDates";

describe("Istanbul log dates", () => {
  it("changes day at Istanbul midnight", () => {
    expect(istanbulToday(new Date("2026-11-07T20:59:59Z"))).toBe("2026-11-07");
    expect(istanbulToday(new Date("2026-11-07T21:00:00Z"))).toBe("2026-11-08");
  });
  it("accepts empty and past dates, rejects invalid and changed future dates", () => {
    const allowed = (value: string | null, previous: string | null = null) => isAllowedLogDate(value, previous, "2026-11-08");
    expect(allowed(null)).toBe(true);
    expect(allowed("")).toBe(true);
    expect(allowed("2026-11-07")).toBe(true);
    expect(allowed("2026-11-08")).toBe(true);
    expect(allowed("2026-11-09")).toBe(false);
    expect(allowed("2026-02-30")).toBe(false);
    expect(allowed("2026-11-08T00:00:00Z")).toBe(false);
    expect(allowed("2027-01-01", "2027-01-01")).toBe(true);
    expect(allowed("2027-01-02", "2027-01-01")).toBe(false);
    expect(allowed(null, "2027-01-01")).toBe(true);
  });
});
