import { Type, Static } from "@sinclair/typebox";

/** Shared response shapes of the jobs dashboard endpoints (docs/jobs-worker.md). */

export const JobStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
]);

export const JobPayloadSchema = Type.Record(Type.String(), Type.Unknown());

export const JobProgressSchema = Type.Object({
  phase: Type.Optional(Type.String()),
  processed: Type.Optional(Type.Number()),
  total: Type.Optional(Type.Number()),
  message: Type.Optional(Type.String()),
});

const NullableDateTime = Type.Union([Type.String({ format: "date-time" }), Type.Null()]);

export const JobSummarySchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  status: JobStatusSchema,
  payload: JobPayloadSchema,
  progress: JobProgressSchema,
  cancelRequested: Type.Boolean(),
  /** Worker id holding the job while it runs; null otherwise. */
  lockedBy: Type.Union([Type.String(), Type.Null()]),
  /** True when a checkpoint exists, i.e. a retry/restart resumes instead of starting over. */
  hasCheckpoint: Type.Boolean(),
  attempts: Type.Integer(),
  maxAttempts: Type.Integer(),
  runAt: Type.String({ format: "date-time" }),
  startedAt: NullableDateTime,
  finishedAt: NullableDateTime,
  error: Type.Union([Type.String(), Type.Null()]),
  recurringJobId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});
export type JobSummary = Static<typeof JobSummarySchema>;

export const JobLogSchema = Type.Object({
  id: Type.Integer(),
  level: Type.Union([Type.Literal("info"), Type.Literal("warn"), Type.Literal("error")]),
  message: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});
export type JobLogResponse = Static<typeof JobLogSchema>;

export const RecurringJobSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  /** 5-field cron (UTC); null = registered job that only runs on demand. */
  cron: Type.Union([Type.String(), Type.Null()]),
  payload: JobPayloadSchema,
  enabled: Type.Boolean(),
  nextRunAt: NullableDateTime,
  lastEnqueuedAt: NullableDateTime,
  lastJobId: Type.Union([Type.String(), Type.Null()]),
});
export type RecurringJobResponse = Static<typeof RecurringJobSchema>;

export const WorkerSchema = Type.Object({
  id: Type.String(),
  hostname: Type.String(),
  version: Type.String(),
  startedAt: Type.String({ format: "date-time" }),
  lastSeenAt: Type.String({ format: "date-time" }),
  online: Type.Boolean(),
});
export type WorkerResponse = Static<typeof WorkerSchema>;

export const JobIdParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});
export type JobIdParams = Static<typeof JobIdParamsSchema>;

export const RecurringJobIdParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type RecurringJobIdParams = Static<typeof RecurringJobIdParamsSchema>;
