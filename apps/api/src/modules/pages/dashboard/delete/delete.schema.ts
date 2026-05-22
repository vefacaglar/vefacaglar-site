import { Type, Static } from "@sinclair/typebox";

export const DeletePageParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeletePageParams = Static<typeof DeletePageParamsSchema>;

export const DeletePageResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeletePageResponse = Static<typeof DeletePageResponseSchema>;
