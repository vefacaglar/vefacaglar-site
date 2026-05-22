import { Type, Static } from "@sinclair/typebox";

export const DeleteDeveloperParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeleteDeveloperParams = Static<typeof DeleteDeveloperParamsSchema>;

export const DeleteDeveloperResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeleteDeveloperResponse = Static<typeof DeleteDeveloperResponseSchema>;
