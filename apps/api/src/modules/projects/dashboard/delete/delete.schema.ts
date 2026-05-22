import { Type, Static } from "@sinclair/typebox";

export const DeleteProjectParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeleteProjectParams = Static<typeof DeleteProjectParamsSchema>;

export const DeleteProjectResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeleteProjectResponse = Static<typeof DeleteProjectResponseSchema>;
