import { Type, type Static } from "@sinclair/typebox";
import { CompanyMatchSchema } from "../companies/companies.schema";

export const SuggestQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 100 })),
});
export type SuggestQuery = Static<typeof SuggestQuerySchema>;

export const GameSuggestionSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  releaseYear: Type.Union([Type.Integer(), Type.Null()]),
  developer: Type.Union([Type.String(), Type.Null()]),
});
export type GameSuggestion = Static<typeof GameSuggestionSchema>;

export const SuggestionGroupSchema = Type.Union([Type.Literal("developers"), Type.Literal("publishers"), Type.Literal("games")]);
export type SuggestionGroup = Static<typeof SuggestionGroupSchema>;

export const SuggestResponseSchema = Type.Object({
  developers: Type.Array(CompanyMatchSchema, { maxItems: 5 }),
  publishers: Type.Array(CompanyMatchSchema, { maxItems: 5 }),
  games: Type.Array(GameSuggestionSchema, { maxItems: 5 }),
  /** All three group keys, best-matching group first; the dropdown renders and navigates in this order. */
  order: Type.Array(SuggestionGroupSchema, { minItems: 3, maxItems: 3 }),
});
export type SuggestResponse = Static<typeof SuggestResponseSchema>;
