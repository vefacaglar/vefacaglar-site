import { Type, type Static } from "@sinclair/typebox";
import { MovieCardSchema } from "../../list/list.schema";

export const MoviePersonRoleSchema = Type.Union([
  Type.Literal("cast"), Type.Literal("director"), Type.Literal("producer"),
]);
export const MoviePersonFilmSchema = Type.Object({
  ...MovieCardSchema.properties,
  roles: Type.Array(MoviePersonRoleSchema),
});
export const GetMoviePersonParamsSchema = Type.Object({
  wikidataId: Type.String({ pattern: "^Q[1-9][0-9]{0,20}$" }),
});
export const MoviePersonPageSchema = Type.Object({
  person: Type.Object({ wikidataId: Type.String(), name: Type.String() }),
  items: Type.Array(MoviePersonFilmSchema),
  total: Type.Number(),
});

export type MoviePersonRole = Static<typeof MoviePersonRoleSchema>;
export type MoviePersonFilm = Static<typeof MoviePersonFilmSchema>;
export type GetMoviePersonParams = Static<typeof GetMoviePersonParamsSchema>;
export type MoviePersonPage = Static<typeof MoviePersonPageSchema>;
