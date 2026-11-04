// Shapes returned by the jobs API (see docs/jobs-worker.md). Timestamps are ISO strings or null.

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobProgress = {
  phase?: string;
  processed?: number;
  total?: number;
  message?: string;
};

export type JobSummary = {
  id: string;
  type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  progress: JobProgress;
  cancelRequested: boolean;
  attempts: number;
  maxAttempts: number;
  runAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  recurringJobId: string | null;
  /** Worker id holding the job while it runs. */
  lockedBy: string | null;
  /** A retry continues from the saved checkpoint instead of starting over. */
  hasCheckpoint: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JobLog = {
  id: number;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};

export type JobDetail = { job: JobSummary; logs: JobLog[] };

export type JobList = { items: JobSummary[]; total: number; page: number; limit: number };

/**
 * A registered (manually triggered) job definition. `cron` is null for manual-only
 * jobs; `currentJob` is the queued/running run, `lastJob` the most recent run.
 */
export type RecurringJob = {
  id: string;
  type: string;
  cron: string | null;
  payload: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: string | null;
  lastEnqueuedAt: string | null;
  lastJobId: string | null;
  description: string | null;
  currentJob: JobSummary | null;
  lastJob: JobSummary | null;
};

export type Worker = {
  id: string;
  hostname: string;
  version: string;
  startedAt: string;
  lastSeenAt: string;
  online: boolean;
};

/** Max log lines the API returns per request; a full page means there may be more. */
export const LOG_PAGE_SIZE = 200;

export function isActiveStatus(status: JobStatus): boolean {
  return status === "queued" || status === "running";
}

/** Run-list filters: `processing` = queued + running. */
export type JobFilter = "processing" | "succeeded" | "failed" | "cancelled";

export const JOB_FILTERS: JobFilter[] = ["processing", "succeeded", "failed", "cancelled"];

export function isJobFilter(value: string | undefined): value is JobFilter {
  return !!value && (JOB_FILTERS as string[]).includes(value);
}
