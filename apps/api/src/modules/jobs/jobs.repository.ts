import { jobs, jobLogs, recurringJobs, workers } from "@vefacaglar/db";
import { and, asc, count, desc, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type {
  IJobsRepository,
  Job,
  JobListFilter,
  JobLog,
  JobStatus,
  JobWorker,
  NewJob,
  RecurringJob,
  RecurringJobOverview,
} from "./jobs.repository.interface";
import { JOB_EVENTS_CHANNEL } from "./job-events.listener.interface";

const ACTIVE_STATUSES: JobStatus[] = ["queued", "running"];
const RETRYABLE_STATUSES: JobStatus[] = ["failed", "cancelled"];
const TERMINAL_STATUSES: JobStatus[] = ["succeeded", "failed", "cancelled"];
/** Wakes the worker (new claimable job). */
const JOBS_CHANNEL = "jobs";

@injectable()
export class DrizzleJobsRepository implements IJobsRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async list(filter: JobListFilter): Promise<{ items: Job[]; total: number }> {
    const conditions: SQL[] = [];
    if (filter.status === "processing") conditions.push(inArray(jobs.status, ACTIVE_STATUSES));
    else if (filter.status) conditions.push(eq(jobs.status, filter.status));
    if (filter.type) conditions.push(eq(jobs.type, filter.type));
    if (filter.recurringJobId) conditions.push(eq(jobs.recurringJobId, filter.recurringJobId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      this.dbProvider.client
        .select()
        .from(jobs)
        .where(where)
        .orderBy(desc(jobs.createdAt), desc(jobs.id))
        .limit(filter.limit)
        .offset((filter.page - 1) * filter.limit),
      this.dbProvider.client.select({ total: count() }).from(jobs).where(where),
    ]);

    return { items, total: Number(total) };
  }

  async findById(id: string): Promise<Job | null> {
    const [row] = await this.dbProvider.client.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return row ?? null;
  }

  async listLogs(jobId: string, afterLogId: number, limit: number): Promise<JobLog[]> {
    return this.dbProvider.client
      .select()
      .from(jobLogs)
      .where(and(eq(jobLogs.jobId, jobId), gt(jobLogs.id, afterLogId)))
      .orderBy(asc(jobLogs.id))
      .limit(limit);
  }

  async findJobWithLogsAfter(
    id: string,
    afterLogId: number | null,
    limit: number
  ): Promise<{ job: Job; logs: JobLog[] } | null> {
    // Job first, logs second: a terminal status read here implies every log
    // the worker wrote before finishing is visible to the logs query below.
    const job = await this.findById(id);
    if (!job) return null;

    if (afterLogId === null) {
      const tail = await this.dbProvider.client
        .select()
        .from(jobLogs)
        .where(eq(jobLogs.jobId, id))
        .orderBy(desc(jobLogs.id))
        .limit(limit);
      return { job, logs: tail.reverse() };
    }

    const logs = await this.listLogs(id, afterLogId, limit);
    return { job, logs };
  }

  async findActiveByConcurrencyKey(concurrencyKey: string): Promise<Job | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(jobs)
      .where(and(eq(jobs.concurrencyKey, concurrencyKey), inArray(jobs.status, ACTIVE_STATUSES)))
      .limit(1);
    return row ?? null;
  }

  async enqueue(
    values: Pick<NewJob, "type" | "payload" | "concurrencyKey" | "recurringJobId" | "createdBy">
  ): Promise<Job | null> {
    return this.dbProvider.transaction(async () => {
      // Match the scheduler's recurring -> jobs lock order. Inserting first
      // can deadlock its concurrency-key check with this metadata update.
      if (values.recurringJobId) {
        await this.dbProvider.client.select({ id: recurringJobs.id }).from(recurringJobs)
          .where(eq(recurringJobs.id, values.recurringJobId)).for("no key update");
      }
      const [row] = await this.dbProvider.client
        .insert(jobs)
        .values(values)
        // Targets the partial unique index on `concurrency_key` (active jobs only).
        .onConflictDoNothing({
          target: jobs.concurrencyKey,
          where: sql`status in ('queued', 'running')`,
        })
        .returning();
      if (!row) return null;

      if (values.recurringJobId) {
        await this.dbProvider.client
          .update(recurringJobs)
          .set({ lastEnqueuedAt: new Date(), lastJobId: row.id, updatedAt: new Date() })
          .where(eq(recurringJobs.id, values.recurringJobId));
      }

      await this.notifyWorker(row.id);
      await this.notifyJobEvent(row.id);
      return row;
    });
  }

  async cancelQueued(id: string): Promise<Job | null> {
    return this.dbProvider.transaction(async () => {
      const now = new Date();
      const [row] = await this.dbProvider.client
        .update(jobs)
        .set({ status: "cancelled", finishedAt: now, lockedBy: null, lockedAt: null, updatedAt: now })
        .where(and(eq(jobs.id, id), eq(jobs.status, "queued")))
        .returning();
      if (!row) return null;

      await this.notifyJobEvent(row.id);
      return row;
    });
  }

  async requestCancel(id: string): Promise<Job | null> {
    return this.dbProvider.transaction(async () => {
      const [row] = await this.dbProvider.client
        .update(jobs)
        .set({ cancelRequested: true, updatedAt: new Date() })
        .where(and(eq(jobs.id, id), eq(jobs.status, "running")))
        .returning();
      if (!row) return null;

      await this.notifyJobEvent(row.id);
      return row;
    });
  }

  async requeue(id: string): Promise<Job | null> {
    return this.dbProvider.transaction(async () => {
      const now = new Date();
      const [row] = await this.dbProvider.client
        .update(jobs)
        .set({
          status: "queued",
          attempts: 0,
          cancelRequested: false,
          runAt: now,
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
          finishedAt: null,
          error: null,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, id), inArray(jobs.status, RETRYABLE_STATUSES)))
        .returning();
      if (!row) return null;

      await this.notifyWorker(row.id);
      await this.notifyJobEvent(row.id);
      return row;
    });
  }

  async listRecurring(): Promise<RecurringJob[]> {
    return this.dbProvider.client.select().from(recurringJobs).orderBy(asc(recurringJobs.id));
  }

  async listRecurringOverview(): Promise<RecurringJobOverview[]> {
    const rows = await this.listRecurring();
    // A handful of registered jobs: two indexed lookups each is simpler than a lateral join.
    return Promise.all(
      rows.map(async (recurring) => {
        const belongs = or(eq(jobs.recurringJobId, recurring.id), eq(jobs.type, recurring.type));
        const [[currentJob], [lastJob]] = await Promise.all([
          this.dbProvider.client
            .select()
            .from(jobs)
            .where(and(belongs, inArray(jobs.status, ACTIVE_STATUSES)))
            .orderBy(desc(jobs.createdAt), desc(jobs.id))
            .limit(1),
          this.dbProvider.client
            .select()
            .from(jobs)
            .where(and(belongs, inArray(jobs.status, TERMINAL_STATUSES)))
            .orderBy(sql`${jobs.finishedAt} desc nulls last`, desc(jobs.createdAt), desc(jobs.id))
            .limit(1),
        ]);
        return { recurring, currentJob: currentJob ?? null, lastJob: lastJob ?? null };
      })
    );
  }

  async findRecurringById(id: string): Promise<RecurringJob | null> {
    const [row] = await this.dbProvider.client.select().from(recurringJobs).where(eq(recurringJobs.id, id)).limit(1);
    return row ?? null;
  }

  async findRecurringByType(type: string): Promise<RecurringJob | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(recurringJobs)
      .where(eq(recurringJobs.type, type))
      .orderBy(asc(recurringJobs.id))
      .limit(1);
    return row ?? null;
  }

  async updateRecurring(id: string, patch: { enabled?: boolean; cron?: string | null }): Promise<RecurringJob | null> {
    const set: Partial<typeof recurringJobs.$inferInsert> = { updatedAt: new Date() };
    if (patch.enabled !== undefined) set.enabled = patch.enabled;
    if (patch.cron !== undefined) {
      set.cron = patch.cron;
      set.nextRunAt = null;
    }
    const [row] = await this.dbProvider.client
      .update(recurringJobs)
      .set(set)
      .where(eq(recurringJobs.id, id))
      .returning();
    return row ?? null;
  }

  async listWorkers(): Promise<JobWorker[]> {
    return this.dbProvider.client.select().from(workers).orderBy(desc(workers.lastSeenAt));
  }

  private async notifyWorker(jobId: string): Promise<void> {
    await this.dbProvider.client.execute(sql`select pg_notify(${JOBS_CHANNEL}, ${jobId})`);
  }

  /** Live dashboard streams (see PgJobEventsListener). Call inside the state-changing transaction. */
  private async notifyJobEvent(jobId: string): Promise<void> {
    await this.dbProvider.client.execute(sql`select pg_notify(${JOB_EVENTS_CHANNEL}, ${jobId})`);
  }
}
