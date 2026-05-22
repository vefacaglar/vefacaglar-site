import { Type, Static } from "@sinclair/typebox";

export const DeleteThemeParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeleteThemeParams = Static<typeof DeleteThemeParamsSchema>;

export const DeleteThemeResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeleteThemeResponse = Static<typeof DeleteThemeResponseSchema>;
