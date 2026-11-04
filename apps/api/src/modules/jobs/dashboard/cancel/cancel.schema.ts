import { Static } from "@sinclair/typebox";
import { JobSummarySchema } from "../../jobs.schema";

export { JobIdParamsSchema as CancelJobParamsSchema, type JobIdParams as CancelJobParams } from "../../jobs.schema";

export const CancelJobResponseSchema = JobSummarySchema;
export type CancelJobResponse = Static<typeof CancelJobResponseSchema>;
