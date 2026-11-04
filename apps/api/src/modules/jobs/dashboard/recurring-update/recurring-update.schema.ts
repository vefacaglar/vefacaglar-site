import { Type, Static } from "@sinclair/typebox";
import { RecurringJobSchema } from "../../jobs.schema";

export {
  RecurringJobIdParamsSchema as UpdateRecurringJobParamsSchema,
  type RecurringJobIdParams as UpdateRecurringJobParams,
} from "../../jobs.schema";

export const UpdateRecurringJobRequestSchema = Type.Object(
  {
    enabled: Type.Optional(Type.Boolean()),
    cron: Type.Optional(
      Type.Union([Type.String({ minLength: 1 }), Type.Null()], {
        description: "Standard 5-field cron expression (UTC); null clears it (manual-only registered job).",
      })
    ),
  },
  { minProperties: 1, additionalProperties: false }
);
export type UpdateRecurringJobRequest = Static<typeof UpdateRecurringJobRequestSchema>;

export const UpdateRecurringJobResponseSchema = RecurringJobSchema;
export type UpdateRecurringJobResponse = Static<typeof UpdateRecurringJobResponseSchema>;
