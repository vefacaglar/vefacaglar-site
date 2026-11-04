import { Type, Static } from "@sinclair/typebox";
import { JobSummarySchema, RecurringJobSchema } from "../../jobs.schema";

const NullableJobSummary = Type.Union([JobSummarySchema, Type.Null()]);

export const RegisteredJobSchema = Type.Composite([
  RecurringJobSchema,
  Type.Object({
    /** Static English description of the job type; null if the type is not allowlisted. */
    description: Type.Union([Type.String(), Type.Null()]),
    /** Newest queued/running run of this registered job. */
    currentJob: NullableJobSummary,
    /** Most recently finished (succeeded/failed/cancelled) run. */
    lastJob: NullableJobSummary,
  }),
]);
export type RegisteredJob = Static<typeof RegisteredJobSchema>;

export const ListRecurringJobsResponseSchema = Type.Object({
  items: Type.Array(RegisteredJobSchema),
});
export type ListRecurringJobsResponse = Static<typeof ListRecurringJobsResponseSchema>;
