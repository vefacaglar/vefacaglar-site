import postgres from "postgres";
import { injectable } from "tsyringe";
import { JOB_EVENTS_CHANNEL, type IJobEventsListener } from "./job-events.listener.interface";

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/vefa_site";
/** Close the dedicated connection this long after the last subscriber left. */
const IDLE_SHUTDOWN_MS = 60_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 30_000;

type Callback = () => void;

/**
 * Process-wide `LISTEN job_events` on ONE dedicated postgres-js connection
 * (same `DATABASE_URL` as the Drizzle pool, but outside of it), fanned out to
 * subscribers by job id.
 *
 * - Nothing connects at import/registration time; the connection is opened on
 *   the first subscriber and closed again after `IDLE_SHUTDOWN_MS` without any.
 * - On connection loss it re-issues LISTEN with exponential backoff (+ jitter)
 *   and then pokes every subscriber so they re-read state they may have missed.
 */
@injectable()
export class PgJobEventsListener implements IJobEventsListener {
  private readonly subscribers = new Map<string, Set<Callback>>();
  private sql: postgres.Sql | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;

  subscribe(jobId: string, onChange: Callback): () => void {
    // Wrap so the same function can subscribe twice and unsubscribe independently.
    const entry: Callback = () => onChange();
    let set = this.subscribers.get(jobId);
    if (!set) {
      set = new Set();
      this.subscribers.set(jobId, set);
    }
    set.add(entry);

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (!this.sql) this.connect();

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const current = this.subscribers.get(jobId);
      if (!current) return;
      current.delete(entry);
      if (current.size === 0) this.subscribers.delete(jobId);
      if (this.subscribers.size === 0) this.scheduleIdleShutdown();
    };
  }

  async stop(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    await this.teardown();
  }

  private connect(): void {
    const sql: postgres.Sql = postgres(process.env.DATABASE_URL || DEFAULT_DATABASE_URL, {
      max: 1,
      idle_timeout: 0,
      max_lifetime: null,
      connect_timeout: 10,
      keep_alive: 30,
      prepare: false,
      fetch_types: false,
      onnotice: () => {},
      connection: { application_name: "vefa-api-job-events" },
      onclose: () => this.handleConnectionLost(sql),
      // Supported at runtime by postgres-js but missing from its typings.
      onnotify: (channel: string, payload: string) => {
        if (channel === JOB_EVENTS_CHANNEL) this.dispatch(payload.trim());
      },
    } as postgres.Options<{}>);
    this.sql = sql;
    void this.listen(sql);
  }

  private async listen(sql: postgres.Sql): Promise<void> {
    try {
      await sql.unsafe(`LISTEN ${JOB_EVENTS_CHANNEL}`);
    } catch (err) {
      if (this.sql !== sql) return;
      console.error("[job-events] LISTEN failed:", (err as Error).message);
      this.handleConnectionLost(sql);
      return;
    }
    if (this.sql !== sql) return;
    this.reconnectAttempt = 0;
    // (Re)connected: anything may have changed meanwhile.
    this.broadcast();
  }

  private handleConnectionLost(sql: postgres.Sql): void {
    if (this.sql !== sql || this.reconnectTimer) return;
    const exp = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.reconnectAttempt);
    const delay = Math.round(exp / 2 + Math.random() * (exp / 2));
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.sql !== sql) return;
      if (this.subscribers.size === 0) {
        void this.teardown();
        return;
      }
      // With max: 1 the next query transparently opens a new connection.
      void this.listen(sql);
    }, delay);
  }

  private scheduleIdleShutdown(): void {
    if (this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.subscribers.size === 0) void this.teardown();
    }, IDLE_SHUTDOWN_MS);
    this.idleTimer.unref();
  }

  private async teardown(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    const sql = this.sql;
    this.sql = null;
    if (sql) {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  }

  private dispatch(jobId: string): void {
    const set = this.subscribers.get(jobId);
    if (!set) return;
    for (const callback of [...set]) this.safeCall(callback);
  }

  private broadcast(): void {
    for (const set of [...this.subscribers.values()]) {
      for (const callback of [...set]) this.safeCall(callback);
    }
  }

  private safeCall(callback: Callback): void {
    try {
      callback();
    } catch (err) {
      console.error("[job-events] subscriber failed:", (err as Error).message);
    }
  }
}
