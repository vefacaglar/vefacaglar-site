import { Type, Static } from "@sinclair/typebox";

export const DeletePlatformParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeletePlatformParams = Static<typeof DeletePlatformParamsSchema>;

export const DeletePlatformResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeletePlatformResponse = Static<typeof DeletePlatformResponseSchema>;
