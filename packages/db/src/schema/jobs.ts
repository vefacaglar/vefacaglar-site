import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  integer,
  bigserial,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Background job system (see docs/jobs-worker.md). The API enqueues rows in
 * `jobs`; the Rust worker (apps/worker) claims, runs and checkpoints them.
 */

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type JobLogLevel = 'info' | 'warn' | 'error';
export type JobProgress = { phase?: string; processed?: number; total?: number; message?: string };

export const recurringJobs = pgTable('recurring_jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  /** 5-field cron (UTC); null = registered job that only runs on demand (the scheduler ignores it). */
  cron: text('cron'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  nextRunAt: timestamp('next_run_at', { withTimezone: true, mode: 'date' }),
  lastEnqueuedAt: timestamp('last_enqueued_at', { withTimezone: true, mode: 'date' }),
  lastJobId: uuid('last_job_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  status: text('status').$type<JobStatus>().notNull().default('queued'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  progress: jsonb('progress').$type<JobProgress>().notNull().default({}),
  checkpoint: jsonb('checkpoint'),
  concurrencyKey: text('concurrency_key'),
  cancelRequested: boolean('cancel_requested').notNull().default(false),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  runAt: timestamp('run_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  lockedBy: text('locked_by'),
  lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true, mode: 'date' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
  error: text('error'),
  recurringJobId: text('recurring_job_id').references(() => recurringJobs.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  statusRunAtIdx: index('jobs_status_run_at_idx').on(table.status, table.runAt),
  typeCreatedAtIdx: index('jobs_type_created_at_idx').on(table.type, table.createdAt.desc()),
  activeConcurrencyKeyIdx: uniqueIndex('jobs_active_concurrency_key_idx')
    .on(table.concurrencyKey)
    .where(sql`${table.status} in ('queued', 'running')`),
}));

export const jobLogs = pgTable('job_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  level: text('level').$type<JobLogLevel>().notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  jobIdIdIdx: index('job_logs_job_id_id_idx').on(table.jobId, table.id),
}));

export const workers = pgTable('workers', {
  id: text('id').primaryKey(),
  hostname: text('hostname').notNull(),
  version: text('version').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }).notNull(),
});
