import type { Job, JobLog, JobWorker, RecurringJob } from "./jobs.repository.interface";
import type { JobLogResponse, JobSummary, RecurringJobResponse, WorkerResponse } from "./jobs.schema";

/** A worker counts as online when it reported less than this long ago. */
export const WORKER_ONLINE_WINDOW_MS = 30_000;

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export function toJobSummary(row: Job): JobSummary {
  const progress = row.progress ?? {};
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload: row.payload ?? {},
    progress: {
      phase: progress.phase,
      processed: progress.processed,
      total: progress.total,
      message: progress.message,
    },
    cancelRequested: row.cancelRequested,
    lockedBy: row.lockedBy,
    hasCheckpoint: row.checkpoint !== null && row.checkpoint !== undefined,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    error: row.error,
    recurringJobId: row.recurringJobId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toJobLog(row: JobLog): JobLogResponse {
  return {
    id: row.id,
    level: row.level,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRecurringJob(row: RecurringJob): RecurringJobResponse {
  return {
    id: row.id,
    type: row.type,
    cron: row.cron,
    payload: row.payload ?? {},
    enabled: row.enabled,
    nextRunAt: iso(row.nextRunAt),
    lastEnqueuedAt: iso(row.lastEnqueuedAt),
    lastJobId: row.lastJobId,
  };
}

export function toWorker(row: JobWorker, now: Date): WorkerResponse {
  return {
    id: row.id,
    hostname: row.hostname,
    version: row.version,
    startedAt: row.startedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    online: now.getTime() - row.lastSeenAt.getTime() < WORKER_ONLINE_WINDOW_MS,
  };
}
