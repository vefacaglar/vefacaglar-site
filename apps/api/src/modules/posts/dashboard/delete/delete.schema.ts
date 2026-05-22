import { Type, Static } from "@sinclair/typebox";

export const DeletePostParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeletePostParams = Static<typeof DeletePostParamsSchema>;

export const DeletePostResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeletePostResponse = Static<typeof DeletePostResponseSchema>;
