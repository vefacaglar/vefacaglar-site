import { Type, Static } from "@sinclair/typebox";
import { JobStatusSchema, JobSummarySchema } from "../../jobs.schema";

export const ListJobsQuerySchema = Type.Object({
  status: Type.Optional(
    Type.Union([JobStatusSchema, Type.Literal("processing")], {
      description: "A job status, or `processing` for queued + running.",
    })
  ),
  type: Type.Optional(Type.String({ minLength: 1 })),
  recurringJobId: Type.Optional(Type.String({ minLength: 1, description: "Only runs of this registered job." })),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export type ListJobsQuery = Static<typeof ListJobsQuerySchema>;

export const ListJobsResponseSchema = Type.Object({
  items: Type.Array(JobSummarySchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
});
export type ListJobsResponse = Static<typeof ListJobsResponseSchema>;
