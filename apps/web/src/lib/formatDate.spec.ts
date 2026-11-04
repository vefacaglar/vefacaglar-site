import { describe, expect, it } from "vitest";
import { formatDate, formatRelative, parseDateKey } from "./formatDate";

// vitest.config.ts pins TZ=UTC; local-date assertions below use local getters anyway.

describe("parseDateKey", () => {
  it("reads YYYY-MM-DD as a local date", () => {
    const date = parseDateKey("2024-02-29");
    expect(date).toBeInstanceOf(Date);
    expect([date!.getFullYear(), date!.getMonth(), date!.getDate(), date!.getHours()]).toEqual([2024, 1, 29, 0]);
  });

  it("ignores anything after the date (e.g. a time part)", () => {
    const date = parseDateKey("2024-05-01T23:30:00Z");
    expect([date!.getFullYear(), date!.getMonth(), date!.getDate()]).toEqual([2024, 4, 1]);
  });

  it("returns null for missing input", () => {
    expect(parseDateKey(null)).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
    expect(parseDateKey("")).toBeNull();
  });

  it("returns null for other formats", () => {
    expect(parseDateKey("24-05-01")).toBeNull();
    expect(parseDateKey("2024/05/01")).toBeNull();
    expect(parseDateKey(" 2024-05-01")).toBeNull();
    expect(parseDateKey("May 1, 2024")).toBeNull();
  });

  it("returns null for impossible calendar dates instead of rolling over", () => {
    expect(parseDateKey("2023-02-29")).toBeNull();
    expect(parseDateKey("2024-13-01")).toBeNull();
    expect(parseDateKey("2024-00-10")).toBeNull();
    expect(parseDateKey("2024-04-31")).toBeNull();
    expect(parseDateKey("2024-04-00")).toBeNull();
  });

  it("rejects years 0000-0099", () => {
    // NOTE: `new Date(y, m, d)` maps years 0-99 to 1900-1999, so the round-trip check fails.
    expect(parseDateKey("0099-01-01")).toBeNull();
  });
});

describe("formatRelative", () => {
  const NOW = Date.parse("2026-11-04T12:00:00.000Z");
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it("is empty for missing or unreadable values", () => {
    expect(formatRelative(null, "en", NOW)).toBe("");
    expect(formatRelative(undefined, "en", NOW)).toBe("");
    expect(formatRelative("", "en", NOW)).toBe("");
    expect(formatRelative("whenever", "en", NOW)).toBe("");
  });

  it("says 'now' under half a minute, and for future timestamps", () => {
    expect(formatRelative(ago(0), "en", NOW)).toBe("now");
    expect(formatRelative(ago(29_000), "en", NOW)).toBe("now");
    expect(formatRelative(ago(-5 * DAY), "en", NOW)).toBe("now");
    expect(formatRelative(ago(0), "tr", NOW)).toBe("şimdi");
  });

  it("uses minutes below an hour", () => {
    expect(formatRelative(ago(30_000), "en", NOW)).toBe("1 minute ago");
    expect(formatRelative(ago(5 * MIN), "en", NOW)).toBe("5 minutes ago");
    expect(formatRelative(ago(59 * MIN + 29_000), "en", NOW)).toBe("59 minutes ago");
  });

  it("uses hours below a day", () => {
    expect(formatRelative(ago(59 * MIN + 31_000), "en", NOW)).toBe("1 hour ago");
    expect(formatRelative(ago(HOUR), "en", NOW)).toBe("1 hour ago");
    expect(formatRelative(ago(23 * HOUR + 20 * MIN), "en", NOW)).toBe("23 hours ago");
  });

  it("uses days below a week", () => {
    expect(formatRelative(ago(23 * HOUR + 40 * MIN), "en", NOW)).toBe("yesterday");
    expect(formatRelative(ago(3 * DAY), "en", NOW)).toBe("3 days ago");
    expect(formatRelative(ago(6 * DAY), "en", NOW)).toBe("6 days ago");
  });

  it("uses weeks below 30 days", () => {
    expect(formatRelative(ago(7 * DAY), "en", NOW)).toBe("last week");
    expect(formatRelative(ago(20 * DAY), "en", NOW)).toBe("3 weeks ago");
    expect(formatRelative(ago(29 * DAY), "en", NOW)).toBe("4 weeks ago");
  });

  it("uses months below a year", () => {
    expect(formatRelative(ago(30 * DAY), "en", NOW)).toBe("last month");
    expect(formatRelative(ago(45 * DAY), "en", NOW)).toBe("last month");
    expect(formatRelative(ago(335 * DAY), "en", NOW)).toBe("11 months ago");
  });

  it("uses years once months round up to 12", () => {
    expect(formatRelative(ago(350 * DAY), "en", NOW)).toBe("11 months ago");
    expect(formatRelative(ago(360 * DAY), "en", NOW)).toBe("last year");
    expect(formatRelative(ago(800 * DAY), "en", NOW)).toBe("2 years ago");
  });

  it("speaks Turkish for 'tr' and British English for anything else", () => {
    expect(formatRelative(ago(3 * DAY), "tr", NOW)).toBe("3 gün önce");
    expect(formatRelative(ago(400 * DAY), "tr", NOW)).toBe("geçen yıl");
    expect(formatRelative(ago(3 * DAY), "de", NOW)).toBe("3 days ago");
  });

  it("defaults `now` to the current time", () => {
    expect(formatRelative(new Date(Date.now() - 3 * DAY).toISOString(), "en")).toBe("3 days ago");
  });
});

describe("formatDate", () => {
  it("formats a date key as day, month name, year", () => {
    expect(formatDate("2010-10-19", "en")).toBe("19 October 2010");
    expect(formatDate("2010-10-19", "tr")).toBe("19 Ekim 2010");
  });

  it("does not shift the day for date keys", () => {
    expect(formatDate("2024-01-01", "en")).toBe("1 January 2024");
  });

  it("accepts Date objects", () => {
    expect(formatDate(new Date(2010, 9, 19), "en")).toBe("19 October 2010");
  });

  it("uses British English for any language other than 'tr'", () => {
    expect(formatDate("2010-10-19", "de")).toBe("19 October 2010");
  });

  it("is empty for unreadable strings", () => {
    expect(formatDate("", "en")).toBe("");
    expect(formatDate("2023-02-29", "en")).toBe("");
    expect(formatDate("19/10/2010", "en")).toBe("");
  });
});
