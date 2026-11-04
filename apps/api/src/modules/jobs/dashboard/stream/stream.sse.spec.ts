import { describe, it, expect } from "vitest";
import {
  formatSseComment,
  formatSseEvent,
  formatSseRetry,
  isTerminalStatus,
  resolveLogCursor,
  snapshotChanged,
  snapshotKey,
} from "./stream.sse";
import type { JobSummary } from "../../jobs.schema";

function summary(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "search.reindex",
    status: "running",
    payload: {},
    progress: { phase: "games_en", processed: 1, total: 10 },
    cancelRequested: false,
    lockedBy: "worker-1",
    hasCheckpoint: false,
    attempts: 1,
    maxAttempts: 3,
    runAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:01.000Z",
    finishedAt: null,
    error: null,
    recurringJobId: "search.reindex",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:02.000Z",
    ...overrides,
  };
}

describe("formatSseEvent", () => {
  it("formats an event with id and JSON data", () => {
    expect(formatSseEvent("log", { id: 7, message: "hi" }, 7)).toBe(
      'event: log\nid: 7\ndata: {"id":7,"message":"hi"}\n\n'
    );
  });

  it("omits the id line when no id is given", () => {
    expect(formatSseEvent("done", { status: "succeeded" })).toBe('event: done\ndata: {"status":"succeeded"}\n\n');
  });

  it("keeps newlines inside strings escaped on a single data line", () => {
    const out = formatSseEvent("log", { message: "a\nb\r\nc" }, 1);
    expect(out.split("\n").filter((line) => line.startsWith("data: "))).toHaveLength(1);
    expect(out).toContain('"a\\nb\\r\\nc"');
  });
});

describe("formatSseComment / formatSseRetry", () => {
  it("formats a comment ping", () => {
    expect(formatSseComment("ping")).toBe(": ping\n\n");
    expect(formatSseComment("a\nb")).toBe(": a b\n\n");
  });

  it("formats the retry hint", () => {
    expect(formatSseRetry(3000)).toBe("retry: 3000\n\n");
  });
});

describe("isTerminalStatus", () => {
  it.each([
    ["succeeded", true],
    ["failed", true],
    ["cancelled", true],
    ["queued", false],
    ["running", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });
});

describe("resolveLogCursor", () => {
  it("returns null without header and query", () => {
    expect(resolveLogCursor(undefined, undefined)).toBeNull();
  });

  it("uses afterLogId when there is no Last-Event-ID", () => {
    expect(resolveLogCursor(undefined, 42)).toBe(42);
    expect(resolveLogCursor("", 42)).toBe(42);
  });

  it("lets Last-Event-ID override afterLogId", () => {
    expect(resolveLogCursor("100", 42)).toBe(100);
    expect(resolveLogCursor(" 0 ", 42)).toBe(0);
    expect(resolveLogCursor(["7", "8"], undefined)).toBe(7);
  });

  it("ignores a malformed Last-Event-ID", () => {
    expect(resolveLogCursor("abc", 42)).toBe(42);
    expect(resolveLogCursor("-1", undefined)).toBeNull();
    expect(resolveLogCursor("1.5", 3)).toBe(3);
  });

  it("rejects unsafe or negative numeric cursors", () => {
    expect(resolveLogCursor(undefined, -1)).toBeNull();
    expect(resolveLogCursor(undefined, Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });
});

describe("snapshot diffing", () => {
  it("is stable regardless of key order and undefined fields", () => {
    const a = summary({ progress: { processed: 1, total: 10, phase: "games_en", message: undefined } });
    const b = summary({ progress: { phase: "games_en", total: 10, processed: 1 } });
    expect(snapshotKey(a)).toBe(snapshotKey(b));
  });

  it("ignores updatedAt alone", () => {
    const key = snapshotKey(summary());
    expect(snapshotChanged(key, summary({ updatedAt: "2026-01-01T00:09:00.000Z" }))).toBe(false);
  });

  it.each<Partial<JobSummary>>([
    { status: "succeeded" },
    { progress: { phase: "games_en", processed: 2, total: 10 } },
    { cancelRequested: true },
    { error: "boom" },
    { attempts: 2 },
    { hasCheckpoint: true },
  ])("detects a change of %j", (change) => {
    const key = snapshotKey(summary());
    expect(snapshotChanged(key, summary(change))).toBe(true);
  });

  it("treats the first snapshot as a change", () => {
    expect(snapshotChanged(null, summary())).toBe(true);
  });
});
