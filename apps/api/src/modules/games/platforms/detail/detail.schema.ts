import { Type, Static } from "@sinclair/typebox";
import { PlatformResponseSchema } from "../list/list.schema";

export const GetPlatformParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetPlatformParams = Static<typeof GetPlatformParamsSchema>;
export type PlatformResponse = Static<typeof PlatformResponseSchema>;
export { PlatformResponseSchema };
