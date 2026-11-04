import type { IJobsRepository, Job, JobLog } from "../../jobs.repository.interface";
import type { IJobEventsListener } from "../../job-events.listener.interface";
import { toJobLog, toJobSummary } from "../../jobs.mapper";
import {
  formatSseComment,
  formatSseEvent,
  formatSseRetry,
  isTerminalStatus,
  snapshotKey,
} from "./stream.sse";

/** Where the stream writes to (the raw HTTP response in production, a fake in tests). */
export interface SseSink {
  /** Returns `false` when the chunk was buffered because the client is slow (backpressure). */
  write(chunk: string): boolean;
  /** Ends the response. Never called after the client disconnected. */
  end(): void;
}

export interface JobStreamOptions {
  /** Logs fetched per repository call (also the initial backlog cap). */
  batchSize: number;
  /** Minimum delay between two fetches; bursts of notifications are coalesced. */
  debounceMs: number;
  /** Safety-net re-check (missed notifications, worker not notifying). */
  pollMs: number;
  pingMs: number;
  maxLifetimeMs: number;
  /** A client that does not drain its buffer within this time is disconnected. */
  drainTimeoutMs: number;
  retryMs: number;
}

export const DEFAULT_JOB_STREAM_OPTIONS: JobStreamOptions = {
  batchSize: 500,
  debounceMs: 250,
  pollMs: 2_000,
  pingMs: 15_000,
  maxLifetimeMs: 30 * 60_000,
  drainTimeoutMs: 30_000,
  retryMs: 3_000,
};

interface Logger {
  warn(obj: unknown, msg?: string): void;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * One open SSE connection for one job.
 *
 * - The DB is the buffer: the log cursor only advances for chunks handed to
 *   the sink, so a slow client (write() === false) is paused without losing
 *   anything and resumes from the cursor on `resume()` (drain).
 * - All refreshes go through `requestRefresh()`, which coalesces notifications,
 *   polls and drains into at most one fetch per `debounceMs` and never runs two
 *   fetches concurrently.
 * - After `close()` nothing is written, every timer is cleared and the
 *   listener subscription is released.
 */
export class JobStream {
  private sink: SseSink | null = null;
  private onEnded: (() => void) | null = null;
  private closed = false;
  private paused = false;
  private fetching = false;
  private pending = false;
  private lastFetchAt = 0;
  private lastSnapshotKey: string | null = null;
  private cursor: number | null;
  private unsubscribe: (() => void) | null = null;
  private debounceTimer: Timer | null = null;
  private drainTimer: Timer | null = null;
  private lifetimeTimer: Timer | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly jobsRepo: IJobsRepository,
    private readonly listener: IJobEventsListener,
    readonly jobId: string,
    cursor: number | null,
    private readonly initial: { job: Job; logs: JobLog[] },
    private readonly options: JobStreamOptions = DEFAULT_JOB_STREAM_OPTIONS,
    private readonly log?: Logger
  ) {
    this.cursor = cursor;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Last log id handed to the sink (`null` = none yet and no cursor given). */
  get logCursor(): number | null {
    return this.cursor;
  }

  /** Starts streaming. `onEnded` runs once when the stream stops for any reason. */
  start(sink: SseSink, onEnded?: () => void): void {
    if (this.sink || this.closed) return;
    this.sink = sink;
    this.onEnded = onEnded ?? null;

    this.write(formatSseRetry(this.options.retryMs));
    this.unsubscribe = this.listener.subscribe(this.jobId, () => this.requestRefresh());
    this.pollTimer = setInterval(() => this.requestRefresh(), this.options.pollMs);
    this.pingTimer = setInterval(() => {
      if (!this.paused) this.write(formatSseComment("ping"));
    }, this.options.pingMs);
    // Ends without `done`; the client reconnects with Last-Event-ID.
    this.lifetimeTimer = setTimeout(() => this.finish(), this.options.maxLifetimeMs);

    this.lastFetchAt = Date.now();
    this.apply(this.initial.job, this.initial.logs);
  }

  /** The sink drained its buffer (`drain` event of the response). */
  resume(): void {
    if (this.closed || !this.paused) return;
    this.paused = false;
    this.clearTimer("drainTimer");
    this.requestRefresh();
  }

  /** Client disconnected or the server shuts down: stop without writing anything. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTimer("debounceTimer");
    this.clearTimer("drainTimer");
    this.clearTimer("lifetimeTimer");
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pollTimer = null;
    this.pingTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    const onEnded = this.onEnded;
    this.onEnded = null;
    onEnded?.();
  }

  /** Ends the response gracefully (done / lifetime / slow client / job gone). */
  finish(): void {
    if (this.closed) return;
    const sink = this.sink;
    this.close();
    sink?.end();
  }

  requestRefresh(): void {
    if (this.closed) return;
    if (this.paused || this.fetching) {
      this.pending = true;
      return;
    }
    if (this.debounceTimer) return;
    const wait = Math.max(0, this.lastFetchAt + this.options.debounceMs - Date.now());
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.refresh();
    }, wait);
  }

  private async refresh(): Promise<void> {
    if (this.closed) return;
    if (this.paused) {
      this.pending = true;
      return;
    }
    this.fetching = true;
    this.pending = false;
    this.lastFetchAt = Date.now();

    let result: { job: Job; logs: JobLog[] } | null;
    try {
      result = await this.jobsRepo.findJobWithLogsAfter(this.jobId, this.cursor, this.options.batchSize);
    } catch (err) {
      this.fetching = false;
      // Transient DB error: the next notification or poll retries.
      this.log?.warn({ err, jobId: this.jobId }, "[jobs] stream refresh failed");
      return;
    }
    this.fetching = false;
    if (this.closed) return;

    if (!result) {
      // The job was deleted while streaming.
      this.finish();
      return;
    }
    this.apply(result.job, result.logs);
  }

  private apply(job: Job, logs: JobLog[]): void {
    const summary = toJobSummary(job);
    const key = snapshotKey(summary);
    if (key !== this.lastSnapshotKey && !this.paused) {
      this.lastSnapshotKey = key;
      this.write(formatSseEvent("snapshot", summary));
    }

    let written = 0;
    for (const log of logs) {
      if (this.paused || this.closed) break;
      // A chunk handed to write() is buffered even when it returns false.
      this.write(formatSseEvent("log", toJobLog(log), log.id));
      this.cursor = log.id;
      written++;
    }
    if (this.cursor === null) this.cursor = 0;
    if (this.closed) return;

    const moreLogs = written < logs.length || logs.length >= this.options.batchSize;
    if (this.paused) {
      this.pending = true;
      return;
    }
    if (isTerminalStatus(summary.status) && !moreLogs && key === this.lastSnapshotKey) {
      this.write(formatSseEvent("done", { status: summary.status }));
      this.finish();
      return;
    }
    if (moreLogs || this.pending) this.requestRefresh();
  }

  private write(chunk: string): boolean {
    if (this.closed || !this.sink) return false;
    const ok = this.sink.write(chunk);
    if (!ok && !this.paused) {
      this.paused = true;
      this.drainTimer = setTimeout(() => {
        this.drainTimer = null;
        this.log?.warn({ jobId: this.jobId }, "[jobs] stream client too slow, closing");
        this.finish();
      }, this.options.drainTimeoutMs);
    }
    return ok;
  }

  private clearTimer(name: "debounceTimer" | "drainTimer" | "lifetimeTimer"): void {
    const timer = this[name];
    if (timer) clearTimeout(timer);
    this[name] = null;
  }
}
