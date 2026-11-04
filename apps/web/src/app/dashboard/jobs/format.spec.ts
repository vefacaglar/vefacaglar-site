import { describe, expect, it } from "vitest";
import { absoluteTime, clockTime, formatCount, formatDuration, jobDuration, relativeTime, shortRelative } from "./format";

const NOW = Date.parse("2026-11-04T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it("returns an em dash for missing or unreadable values", () => {
    expect(relativeTime(null, NOW)).toBe("—");
    expect(relativeTime(undefined, NOW)).toBe("—");
    expect(relativeTime("", NOW)).toBe("—");
    expect(relativeTime("yesterday-ish", NOW)).toBe("—");
  });

  it("says 'just now' within 10 seconds either way", () => {
    expect(relativeTime(at(0), NOW)).toBe("just now");
    expect(relativeTime(at(-9_999), NOW)).toBe("just now");
    expect(relativeTime(at(9_999), NOW)).toBe("just now");
  });

  it("uses seconds from 10s up to a minute", () => {
    expect(relativeTime(at(-10 * SEC), NOW)).toBe("10 seconds ago");
    expect(relativeTime(at(30 * SEC), NOW)).toBe("in 30 seconds");
    // NOTE: rounding happens after the unit is picked, so 59.9s reads "60 seconds ago".
    expect(relativeTime(at(-59_999), NOW)).toBe("60 seconds ago");
  });

  it("uses minutes, hours and days", () => {
    expect(relativeTime(at(-MIN), NOW)).toBe("1 minute ago");
    expect(relativeTime(at(-90 * SEC), NOW)).toBe("2 minutes ago");
    expect(relativeTime(at(-HOUR), NOW)).toBe("1 hour ago");
    expect(relativeTime(at(2 * HOUR), NOW)).toBe("in 2 hours");
    expect(relativeTime(at(-3 * DAY), NOW)).toBe("3 days ago");
  });

  it("uses numeric 'auto' wording for a single day", () => {
    expect(relativeTime(at(-DAY), NOW)).toBe("yesterday");
    expect(relativeTime(at(DAY), NOW)).toBe("tomorrow");
  });

  it("never switches beyond days", () => {
    expect(relativeTime(at(-400 * DAY), NOW)).toBe("400 days ago");
  });
});

describe("shortRelative", () => {
  it("returns an em dash for missing or unreadable values", () => {
    expect(shortRelative(null, NOW)).toBe("—");
    expect(shortRelative(undefined, NOW)).toBe("—");
    expect(shortRelative("nope", NOW)).toBe("—");
  });

  it("says 'just now' within 10 seconds either way", () => {
    expect(shortRelative(at(-5 * SEC), NOW)).toBe("just now");
    expect(shortRelative(at(5 * SEC), NOW)).toBe("just now");
  });

  it("uses compact units with 'ago' / 'in'", () => {
    expect(shortRelative(at(-10 * SEC), NOW)).toBe("10s ago");
    expect(shortRelative(at(-3 * MIN), NOW)).toBe("3m ago");
    expect(shortRelative(at(2 * HOUR), NOW)).toBe("in 2h");
    expect(shortRelative(at(-4 * DAY), NOW)).toBe("4d ago");
    expect(shortRelative(at(45 * DAY), NOW)).toBe("in 45d");
  });

  it("rounds within the picked unit", () => {
    // NOTE: same boundary rounding as relativeTime: 59.9s → "60s", 59.9m → "60m".
    expect(shortRelative(at(-59_999), NOW)).toBe("60s ago");
    expect(shortRelative(at(-(HOUR - 1)), NOW)).toBe("60m ago");
    expect(shortRelative(at(-90 * MIN), NOW)).toBe("2h ago");
  });
});

describe("absoluteTime", () => {
  it("formats as a UTC timestamp without milliseconds", () => {
    expect(absoluteTime("2026-11-04T14:03:12.345Z")).toBe("2026-11-04 14:03:12 UTC");
  });

  it("converts offsets to UTC", () => {
    expect(absoluteTime("2026-11-04T16:03:12+02:00")).toBe("2026-11-04 14:03:12 UTC");
  });

  it("is empty for missing or unreadable values", () => {
    expect(absoluteTime(null)).toBe("");
    expect(absoluteTime(undefined)).toBe("");
    expect(absoluteTime("")).toBe("");
    expect(absoluteTime("garbage")).toBe("");
  });
});

describe("clockTime", () => {
  it("returns the UTC HH:MM:SS", () => {
    expect(clockTime("2026-11-04T14:03:12.999Z")).toBe("14:03:12");
    expect(clockTime("2026-11-04T01:00:00+03:00")).toBe("22:00:00");
  });

  it("is empty for unreadable values", () => {
    expect(clockTime("")).toBe("");
    expect(clockTime("garbage")).toBe("");
  });
});

describe("formatDuration", () => {
  it("returns an em dash for negative or non-finite durations", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(Infinity)).toBe("—");
  });

  it("shows seconds below a minute, rounded to the nearest second", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(499)).toBe("0s");
    expect(formatDuration(500)).toBe("1s");
    expect(formatDuration(12_000)).toBe("12s");
  });

  it("shows minutes with zero-padded seconds", () => {
    expect(formatDuration(125_000)).toBe("2m 05s");
    expect(formatDuration(59_500)).toBe("1m 00s");
  });

  it("shows hours with zero-padded minutes, dropping seconds", () => {
    expect(formatDuration(HOUR + 4 * MIN + 59 * SEC)).toBe("1h 04m");
    expect(formatDuration(25 * HOUR + MIN + SEC)).toBe("25h 01m");
  });
});

describe("jobDuration", () => {
  const start = "2026-11-04T11:00:00.000Z";

  it("is an em dash when the job never started", () => {
    expect(jobDuration({ startedAt: null, finishedAt: null, status: "queued" }, NOW)).toBe("—");
    expect(jobDuration({ startedAt: null, finishedAt: "2026-11-04T11:05:00.000Z", status: "cancelled" }, NOW)).toBe("—");
  });

  it("measures start to finish for finished jobs", () => {
    expect(jobDuration({ startedAt: start, finishedAt: "2026-11-04T11:02:05.000Z", status: "succeeded" }, NOW)).toBe("2m 05s");
  });

  it("measures start to now for running jobs", () => {
    expect(jobDuration({ startedAt: start, finishedAt: null, status: "running" }, NOW)).toBe("1h 00m");
  });

  it("is an em dash for an unfinished job that isn't running", () => {
    expect(jobDuration({ startedAt: start, finishedAt: null, status: "failed" }, NOW)).toBe("—");
    expect(jobDuration({ startedAt: start, finishedAt: null, status: "queued" }, NOW)).toBe("—");
  });

  it("is an em dash when timestamps are unreadable or reversed", () => {
    expect(jobDuration({ startedAt: "garbage", finishedAt: null, status: "running" }, NOW)).toBe("—");
    expect(jobDuration({ startedAt: start, finishedAt: "2026-11-04T10:00:00.000Z", status: "succeeded" }, NOW)).toBe("—");
  });
});

describe("formatCount", () => {
  it("formats numbers with en-GB grouping", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("returns an em dash when missing", () => {
    expect(formatCount(undefined)).toBe("—");
  });
});
