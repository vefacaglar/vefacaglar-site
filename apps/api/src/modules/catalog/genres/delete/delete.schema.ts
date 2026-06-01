import { Type, Static } from "@sinclair/typebox";

export const DeleteGenreParamsSchema = Type.Object({
  id: Type.String(),
});

export type DeleteGenreParams = Static<typeof DeleteGenreParamsSchema>;

export const DeleteGenreResponseSchema = Type.Object({
  success: Type.Boolean(),
});

export type DeleteGenreResponse = Static<typeof DeleteGenreResponseSchema>;
