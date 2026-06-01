import { Type, Static } from "@sinclair/typebox";

export const DeleteGameParamsSchema = Type.Object({
  id: Type.String(),
});

export const DeleteGameResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeleteGameParams = Static<typeof DeleteGameParamsSchema>;
export type DeleteGameResponse = Static<typeof DeleteGameResponseSchema>;
