import { Type, type Static } from "@sinclair/typebox";
import { MoviePersonRoleSchema } from "../detail/detail.schema";

const nullableNumber = Type.Union([Type.Number(), Type.Null()]);

/** Public-safe person summary: identity, all roles, and one notable catalog film. */
export const MoviePersonSummarySchema = Type.Object({
  wikidataId: Type.String(),
  name: Type.String(),
  roles: Type.Array(MoviePersonRoleSchema, { minItems: 1 }),
  knownFor: Type.Union([Type.Object({ slug: Type.String(), title: Type.String(), releaseYear: nullableNumber }), Type.Null()]),
});
export const SearchMoviePeopleQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 140 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 24 })),
});
export const SearchMoviePeopleResponseSchema = Type.Object({ items: Type.Array(MoviePersonSummarySchema) });

export type MoviePersonSummary = Static<typeof MoviePersonSummarySchema>;
export type SearchMoviePeopleQuery = Static<typeof SearchMoviePeopleQuerySchema>;
export type SearchMoviePeopleResponse = Static<typeof SearchMoviePeopleResponseSchema>;
