import type { JobStatus } from "../../jobs.repository.interface";
import type { JobSummary } from "../../jobs.schema";

/** Pure Server-Sent Events helpers for the job stream (no I/O). */

export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  // Disables response buffering in nginx-style reverse proxies.
  "x-accel-buffering": "no",
} as const;

export type JobStreamEvent = "snapshot" | "log" | "done";

/** One `event:` block. `data` is JSON-encoded; every line gets its own `data:` prefix. */
export function formatSseEvent(event: JobStreamEvent, data: unknown, id?: string | number): string {
  let out = `event: ${event}\n`;
  if (id !== undefined) out += `id: ${String(id).replace(/[\r\n]/g, "")}\n`;
  for (const line of JSON.stringify(data).split(/\r\n|\r|\n/)) {
    out += `data: ${line}\n`;
  }
  return `${out}\n`;
}

/** A comment line (ignored by EventSource), used as keep-alive ping. */
export function formatSseComment(text: string): string {
  return `: ${text.replace(/[\r\n]/g, " ")}\n\n`;
}

/** Reconnection delay hint for EventSource. */
export function formatSseRetry(ms: number): string {
  return `retry: ${Math.max(0, Math.floor(ms))}\n\n`;
}

const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set(["succeeded", "failed", "cancelled"]);

export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

const LOG_ID = /^\d{1,15}$/;

function parseLogId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && LOG_ID.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

/**
 * Log cursor for a (re)connecting stream: a valid `Last-Event-ID` header
 * (sent automatically by EventSource on reconnect) wins over `?afterLogId`;
 * a malformed header is ignored. `null` = no cursor (send the backlog tail).
 */
export function resolveLogCursor(lastEventId: string | string[] | undefined, afterLogId: unknown): number | null {
  const header = Array.isArray(lastEventId) ? lastEventId[0] : lastEventId;
  if (header !== undefined && header.trim() !== "") {
    const fromHeader = parseLogId(header);
    if (fromHeader !== null) return fromHeader;
  }
  return afterLogId === undefined || afterLogId === null ? null : parseLogId(afterLogId);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Comparison key of a snapshot. `updatedAt` is ignored so a bare touch of the
 * row (e.g. a heartbeat) does not produce a new `snapshot` event; any change
 * of status, progress, cancelRequested, error, attempts, ... does.
 */
export function snapshotKey(summary: JobSummary): string {
  const { updatedAt: _updatedAt, ...rest } = summary;
  return stableStringify(rest);
}

export function snapshotChanged(previousKey: string | null, summary: JobSummary): boolean {
  return previousKey !== snapshotKey(summary);
}
