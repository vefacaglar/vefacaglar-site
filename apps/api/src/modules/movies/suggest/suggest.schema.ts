import { Type, type Static } from "@sinclair/typebox";
import { MoviePersonSummarySchema } from "../people/search/search.schema";

const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);

export const MovieSuggestQuerySchema = Type.Object({ q: Type.Optional(Type.String({ maxLength: 140 })) });
/** Only what the search dropdown renders: text, no artwork. */
export const MovieSuggestionSchema = Type.Object({
  slug: Type.String(), title: Type.String(), releaseYear: nullableNumber, director: nullableString,
});
export const MovieSuggestResponseSchema = Type.Object({
  movies: Type.Array(MovieSuggestionSchema),
  people: Type.Array(MoviePersonSummarySchema),
});

export type MovieSuggestQuery = Static<typeof MovieSuggestQuerySchema>;
export type MovieSuggestion = Static<typeof MovieSuggestionSchema>;
export type MovieSuggestResponse = Static<typeof MovieSuggestResponseSchema>;
