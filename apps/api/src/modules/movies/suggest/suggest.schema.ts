import { Type, type Static } from "@sinclair/typebox";
import { MoviePersonSummarySchema } from "../people/search/search.schema";

const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);

export const MovieSuggestQuerySchema = Type.Object({ q: Type.Optional(Type.String({ maxLength: 140 })) });
/** Only what the search dropdown renders: text, no artwork. */
export const MovieSuggestionSchema = Type.Object({
  slug: Type.String(), title: Type.String(), releaseYear: nullableNumber, director: nullableString,
});
export const MovieSuggestionGroupSchema = Type.Union([Type.Literal("people"), Type.Literal("movies")]);
export const MovieSuggestResponseSchema = Type.Object({
  movies: Type.Array(MovieSuggestionSchema),
  people: Type.Array(MoviePersonSummarySchema),
  /** Both group keys, best-matching group first; the dropdown renders and navigates in this order. */
  order: Type.Array(MovieSuggestionGroupSchema, { minItems: 2, maxItems: 2 }),
});

export type MovieSuggestQuery = Static<typeof MovieSuggestQuerySchema>;
export type MovieSuggestion = Static<typeof MovieSuggestionSchema>;
export type MovieSuggestionGroup = Static<typeof MovieSuggestionGroupSchema>;
export type MovieSuggestResponse = Static<typeof MovieSuggestResponseSchema>;
