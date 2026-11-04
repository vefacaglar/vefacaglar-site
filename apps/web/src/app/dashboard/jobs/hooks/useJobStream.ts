"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createJobStreamAction, type JobStreamResult } from "../actions";
import { LOG_PAGE_SIZE, isActiveStatus, type JobDetail, type JobLog, type JobSummary } from "../types";

export type StreamConn = "connecting" | "live" | "reconnecting" | "polling" | "ended";

type Mode = "sse" | "poll" | "none";

type Options = {
  /** Highest log id already on screen; the stream continues after it. */
  initialLastLogId?: number | null;
  /** Open a live session on mount (the job is queued/running). */
  startActive: boolean;
  /** Terminal job whose first log page was full: fetch the rest once. */
  catchUp?: boolean;
  onJob: (job: JobSummary) => void;
  /** New log lines, ascending and de-duplicated. Omit to ignore logs. */
  onLogs?: (logs: JobLog[]) => void;
  /** Called once a session has delivered the job's final state. */
  onEnded?: (job: JobSummary | null) => void;
};

const POLL_MS = 2000;
const ERROR_BACKOFF_MS = 5000;
/** Consecutive connections that delivered no event before giving up on SSE. */
const MAX_FAILED_CONNECTIONS = 3;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;

/**
 * Set when the API refuses to mint a stream token (non-404 HTTP error). Later
 * sessions on this page go straight to polling.
 */
let sseUnavailable = false;

class HttpStatusError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function parse<T>(event: Event): T | null {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as T;
  } catch {
    return null;
  }
}

/**
 * Live updates for one job. Prefers Server-Sent Events straight from the API
 * (authorised by a short-lived, job-scoped token minted by a server action) and
 * falls back to polling `/dashboard/jobs/:id/live` when the stream is unavailable
 * or keeps failing. The admin session token never reaches the browser.
 */
export function useJobStream(jobId: string, options: Options) {
  const opts = useRef(options);
  opts.current = options;

  const lastLogId = useRef<number | null>(options.initialLastLogId ?? null);
  const [session, setSession] = useState<{ key: number; mode: Mode }>(() => ({
    key: 0,
    mode: options.startActive ? (sseUnavailable ? "poll" : "sse") : options.catchUp ? "poll" : "none",
  }));
  const [conn, setConn] = useState<StreamConn>(options.startActive ? "connecting" : "ended");
  const [error, setError] = useState<string | null>(null);

  const emitLogs = useCallback((logs: JobLog[]) => {
    const fresh: JobLog[] = [];
    for (const line of logs) {
      if (lastLogId.current === null || line.id > lastLogId.current) {
        fresh.push(line);
        lastLogId.current = line.id;
      }
    }
    if (fresh.length) opts.current.onLogs?.(fresh);
  }, []);

  const fetchLive = useCallback(async (): Promise<JobDetail> => {
    const qs = lastLogId.current !== null ? `?afterLogId=${lastLogId.current}` : "";
    const res = await fetch(`/dashboard/jobs/${encodeURIComponent(jobId)}/live${qs}`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new HttpStatusError(body.message || `HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as JobDetail;
  }, [jobId]);

  useEffect(() => {
    if (session.mode === "none") return;
    let stopped = false;

    // Fetch the authoritative final state plus any trailing logs.
    const drain = async () => {
      let data: JobDetail;
      do {
        data = await fetchLive();
        if (stopped) return;
        opts.current.onJob(data.job);
        emitLogs(data.logs ?? []);
      } while ((data.logs?.length ?? 0) >= LOG_PAGE_SIZE);
      opts.current.onEnded?.(data.job);
    };

    if (session.mode === "sse") {
      // The stream token is only valid for ~2 minutes and only checked at connect,
      // so EventSource's own reconnect (same URL, stale token) is never used: every
      // (re)connect mints a fresh token and resumes after the last received log id.
      let source: EventSource | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let backoffStep = 0;
      let failedConnections = 0;

      const fallBackToPolling = () => {
        source?.close();
        source = null;
        setConn("polling");
        setSession((s) => ({ key: s.key, mode: "poll" }));
      };

      const scheduleReconnect = () => {
        if (stopped) return;
        setConn("reconnecting");
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** backoffStep);
        backoffStep += 1;
        retryTimer = setTimeout(connect, delay);
      };

      // A connection that ends before delivering any event counts as failed.
      const connectionFailed = () => {
        failedConnections += 1;
        if (failedConnections >= MAX_FAILED_CONNECTIONS) fallBackToPolling();
        else scheduleReconnect();
      };

      async function connect() {
        if (stopped) return;
        let stream: JobStreamResult;
        try {
          stream = await createJobStreamAction(jobId);
        } catch {
          stream = { error: "Server connection error.", status: 0 };
        }
        if (stopped) return;

        if ("error" in stream) {
          if (stream.status === 404) {
            setError(stream.error);
            setConn("ended");
            return;
          }
          if (stream.status > 0) {
            // The API refused the token (or has no stream endpoint): poll instead.
            sseUnavailable = true;
            fallBackToPolling();
            return;
          }
          connectionFailed();
          return;
        }

        const after = lastLogId.current;
        const es = new EventSource(after !== null ? `${stream.url}&afterLogId=${after}` : stream.url);
        source = es;
        let heardAny = false;

        const heard = () => {
          if (!heardAny) {
            heardAny = true;
            failedConnections = 0;
            backoffStep = 0;
          }
          setConn("live");
          setError(null);
        };

        es.addEventListener("snapshot", (e) => {
          heard();
          const job = parse<JobSummary>(e);
          if (job) opts.current.onJob(job);
        });
        es.addEventListener("log", (e) => {
          heard();
          const line = parse<JobLog>(e);
          if (line) emitLogs([line]);
        });
        es.addEventListener("done", () => {
          es.close();
          source = null;
          if (stopped) return;
          setConn("ended");
          drain().catch(() => opts.current.onEnded?.(null));
        });
        es.onerror = () => {
          es.close();
          if (source === es) source = null;
          if (stopped) return;
          if (heardAny) scheduleReconnect();
          else connectionFailed();
        };
      }

      setConn("connecting");
      connect();

      return () => {
        stopped = true;
        source?.close();
        if (retryTimer) clearTimeout(retryTimer);
      };
    }

    // Polling: every 2s while queued/running, immediately while a full log page
    // comes back, and stops once the job is terminal and drained.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (ms: number) => {
      if (!stopped) timer = setTimeout(tick, ms);
    };
    async function tick() {
      try {
        const data = await fetchLive();
        if (stopped) return;
        opts.current.onJob(data.job);
        emitLogs(data.logs ?? []);
        setError(null);
        if ((data.logs?.length ?? 0) >= LOG_PAGE_SIZE) {
          schedule(0);
        } else if (isActiveStatus(data.job.status)) {
          setConn("polling");
          schedule(POLL_MS);
        } else {
          setConn("ended");
          opts.current.onEnded?.(data.job);
        }
      } catch (err) {
        if (stopped) return;
        setError(err instanceof Error ? err.message : String(err));
        const status = err instanceof HttpStatusError ? err.status : 0;
        if (status === 401 || status === 403 || status === 404) {
          setConn("ended");
          return;
        }
        setConn("reconnecting");
        schedule(ERROR_BACKOFF_MS);
      }
    }
    schedule(0);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [session, jobId, fetchLive, emitLogs]);

  /** Start a new live session (e.g. after retrying a finished job). */
  const restart = useCallback(() => {
    setSession((s) => ({ key: s.key + 1, mode: sseUnavailable ? "poll" : "sse" }));
  }, []);

  return { conn, error, restart };
}
