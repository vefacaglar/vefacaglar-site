import { Static } from "@sinclair/typebox";
import { JobSummarySchema } from "../../jobs.schema";

export {
  RecurringJobIdParamsSchema as RunRecurringJobParamsSchema,
  type RecurringJobIdParams as RunRecurringJobParams,
} from "../../jobs.schema";

export const RunRecurringJobResponseSchema = JobSummarySchema;
export type RunRecurringJobResponse = Static<typeof RunRecurringJobResponseSchema>;
