import { Type, Static } from "@sinclair/typebox";
import { JobPayloadSchema, JobSummarySchema } from "../../jobs.schema";

export const EnqueueJobRequestSchema = Type.Object({
  type: Type.String({ minLength: 1, description: "Allowlisted job type, e.g. `search.reindex`." }),
  payload: Type.Optional(JobPayloadSchema),
});
export type EnqueueJobRequest = Static<typeof EnqueueJobRequestSchema>;

export const EnqueueJobResponseSchema = JobSummarySchema;
export type EnqueueJobResponse = Static<typeof EnqueueJobResponseSchema>;
