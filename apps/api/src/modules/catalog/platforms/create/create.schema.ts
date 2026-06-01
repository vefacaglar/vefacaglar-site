import { Type, Static } from "@sinclair/typebox";
import { PlatformResponseSchema } from "../list/list.schema";

export const CreatePlatformRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
});

export type CreatePlatformRequest = Static<typeof CreatePlatformRequestSchema>;
export type PlatformResponse = Static<typeof PlatformResponseSchema>;
export { PlatformResponseSchema };
