import { Static } from "@sinclair/typebox";
import { JobSummarySchema } from "../../jobs.schema";

export { JobIdParamsSchema as RetryJobParamsSchema, type JobIdParams as RetryJobParams } from "../../jobs.schema";

export const RetryJobResponseSchema = JobSummarySchema;
export type RetryJobResponse = Static<typeof RetryJobResponseSchema>;
