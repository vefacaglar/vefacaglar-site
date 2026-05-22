import { Type, Static } from "@sinclair/typebox";
import { GenreResponseSchema } from "../list/list.schema";

export const GetGenreParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetGenreParams = Static<typeof GetGenreParamsSchema>;
export type GenreResponse = Static<typeof GenreResponseSchema>;
export { GenreResponseSchema };
