import { Type, Static } from "@sinclair/typebox";

export {
  JobIdParamsSchema as CreateStreamTokenParamsSchema,
  type JobIdParams as CreateStreamTokenParams,
} from "../../jobs.schema";

export const CreateStreamTokenResponseSchema = Type.Object({
  /** HS256 JWT, pass as `?token=` to the stream endpoint. Valid for 120 s (connect time only). */
  token: Type.String(),
  expiresAt: Type.String({ format: "date-time" }),
  /** Path of the SSE endpoint relative to the API origin, e.g. `/api/jobs/dashboard/<id>/stream`. */
  streamPath: Type.String(),
});
export type CreateStreamTokenResponse = Static<typeof CreateStreamTokenResponseSchema>;
