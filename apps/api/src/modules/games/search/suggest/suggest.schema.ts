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

export const SuggestResponseSchema = Type.Object({
  developers: Type.Array(CompanyMatchSchema, { maxItems: 5 }),
  publishers: Type.Array(CompanyMatchSchema, { maxItems: 5 }),
  games: Type.Array(GameSuggestionSchema, { maxItems: 5 }),
});
export type SuggestResponse = Static<typeof SuggestResponseSchema>;
