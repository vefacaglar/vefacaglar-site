import { Type, Static } from "@sinclair/typebox";
import { JobLogSchema, JobSummarySchema } from "../../jobs.schema";

export { JobIdParamsSchema as GetJobParamsSchema, type JobIdParams as GetJobParams } from "../../jobs.schema";

export const GetJobQuerySchema = Type.Object({
  afterLogId: Type.Optional(Type.Integer({ minimum: 0, description: "Only return logs with a greater id." })),
});
export type GetJobQuery = Static<typeof GetJobQuerySchema>;

export const GetJobResponseSchema = Type.Object({
  job: JobSummarySchema,
  logs: Type.Array(JobLogSchema),
});
export type GetJobResponse = Static<typeof GetJobResponseSchema>;
