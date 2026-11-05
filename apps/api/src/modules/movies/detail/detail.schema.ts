import { Type, type Static } from "@sinclair/typebox";
import { MovieCardSchema } from "../list/list.schema";
const nullableString = Type.Union([Type.String(), Type.Null()]);
export const GetMovieParamsSchema = Type.Object({ slug: Type.String({ maxLength: 250 }) });
export const MovieDetailSchema = Type.Composite([MovieCardSchema, Type.Object({
  wikidataId: Type.String(), imdbId: nullableString, description: nullableString, originalTitle: nullableString,
  genres: Type.Array(Type.Object({ name: Type.String(), slug: Type.String() })),
  companies: Type.Array(Type.Object({ wikidataId: Type.String(), name: nullableString })),
  credits: Type.Array(Type.Object({ statementId: Type.String(), role: Type.Union([Type.Literal("cast"), Type.Literal("director"), Type.Literal("producer")]),
    wikidataId: Type.String(), name: nullableString, characterNames: Type.Array(Type.String()),
    rank: Type.Union([Type.Literal("preferred"), Type.Literal("normal"), Type.Literal("deprecated")]) })),
  sourceUpdatedAt: nullableString,
})]);
export type GetMovieParams = Static<typeof GetMovieParamsSchema>;
export type MovieDetail = Static<typeof MovieDetailSchema>;
