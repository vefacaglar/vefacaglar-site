import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { jobs, jobLogs, recurringJobs, workers, JobStatus } from "@vefacaglar/db";

export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
export type JobLog = InferSelectModel<typeof jobLogs>;
export type RecurringJob = InferSelectModel<typeof recurringJobs>;
export type JobWorker = InferSelectModel<typeof workers>;
export type { JobStatus };

/** `processing` = queued + running. */
export type JobStatusFilter = JobStatus | "processing";

export interface JobListFilter {
  status?: JobStatusFilter;
  type?: string;
  recurringJobId?: string;
  page: number;
  limit: number;
}

export interface RecurringJobOverview {
  recurring: RecurringJob;
  /** Newest queued/running job of this registered job (by `recurring_job_id` or type). */
  currentJob: Job | null;
  /** Most recently finished (succeeded/failed/cancelled) job of this registered job. */
  lastJob: Job | null;
}

export interface IJobsRepository {
  list(filter: JobListFilter): Promise<{ items: Job[]; total: number }>;
  findById(id: string): Promise<Job | null>;
  /** Logs with `id > afterLogId`, ascending, at most `limit`. */
  listLogs(jobId: string, afterLogId: number, limit: number): Promise<JobLog[]>;
  /**
   * The job plus its logs, read job-first so every log committed before the
   * job row was read is included. `afterLogId = null` returns the LAST `limit`
   * logs (tail), otherwise logs with `id > afterLogId`; always ascending.
   * Returns `null` if the job does not exist.
   */
  findJobWithLogsAfter(id: string, afterLogId: number | null, limit: number): Promise<{ job: Job; logs: JobLog[] } | null>;
  findActiveByConcurrencyKey(concurrencyKey: string): Promise<Job | null>;

  /**
   * INSERT + `pg_notify('jobs', id)` + `pg_notify('job_events', id)` in one transaction. Returns `null` when an
   * active (queued/running) job with the same concurrency key already exists.
   * When `recurringJobId` is set, the recurring definition's
   * `last_enqueued_at` / `last_job_id` are updated in the same transaction.
   */
  enqueue(values: Pick<NewJob, "type" | "payload" | "concurrencyKey" | "recurringJobId" | "createdBy">): Promise<Job | null>;
  /** queued → cancelled (+ `job_events` notify). Returns `null` if the job is no longer queued. */
  cancelQueued(id: string): Promise<Job | null>;
  /** running → cancel_requested = true (+ `job_events` notify). Returns `null` if the job is not running. */
  requestCancel(id: string): Promise<Job | null>;
  /** failed/cancelled → queued (attempts reset, checkpoint kept) + `jobs` and `job_events` notify. Returns `null` on a state mismatch. */
  requeue(id: string): Promise<Job | null>;

  listRecurring(): Promise<RecurringJob[]>;
  /** Registered jobs with their current (active) and last finished run. */
  listRecurringOverview(): Promise<RecurringJobOverview[]>;
  findRecurringById(id: string): Promise<RecurringJob | null>;
  /** The registered job row for a job type (lowest id if several), or `null`. */
  findRecurringByType(type: string): Promise<RecurringJob | null>;
  /**
   * A cron change (including `null` = manual only) also resets `next_run_at`
   * to null so the worker recomputes it (or ignores the row when cron is null).
   */
  updateRecurring(id: string, patch: { enabled?: boolean; cron?: string | null }): Promise<RecurringJob | null>;

  listWorkers(): Promise<JobWorker[]>;
}
