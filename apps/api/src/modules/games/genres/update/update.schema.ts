import { Type, Static } from "@sinclair/typebox";
import { GenreResponseSchema } from "../list/list.schema";

export const UpdateGenreParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdateGenreRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
});

export type UpdateGenreParams = Static<typeof UpdateGenreParamsSchema>;
export type UpdateGenreRequest = Static<typeof UpdateGenreRequestSchema>;
export type GenreResponse = Static<typeof GenreResponseSchema>;
export { GenreResponseSchema };
