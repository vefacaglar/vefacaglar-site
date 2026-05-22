import { Type, Static } from "@sinclair/typebox";
import { GenreResponseSchema } from "../list/list.schema";

export const CreateGenreRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
});

export type CreateGenreRequest = Static<typeof CreateGenreRequestSchema>;
export type GenreResponse = Static<typeof GenreResponseSchema>;
export { GenreResponseSchema };
