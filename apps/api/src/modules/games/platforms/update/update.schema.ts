import { Type, Static } from "@sinclair/typebox";
import { PlatformResponseSchema } from "../list/list.schema";

export const UpdatePlatformParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdatePlatformRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
});

export type UpdatePlatformParams = Static<typeof UpdatePlatformParamsSchema>;
export type UpdatePlatformRequest = Static<typeof UpdatePlatformRequestSchema>;
export type PlatformResponse = Static<typeof PlatformResponseSchema>;
export { PlatformResponseSchema };
