import { CompletionReportSchema, CompletionSummarySchema } from "../../catalog/completion-times/completion-sources.schema";
import { Type, Static } from "@sinclair/typebox";
import { GameCompletionTimesSchema } from "../../catalog/completion-times/completion-times.schema";

export const ListGamesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })),
  q: Type.Optional(Type.String({ maxLength: 100 })),
});
export type ListGamesQuery = Static<typeof ListGamesQuerySchema>;

export const GameCardSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  releaseDate: Type.Union([Type.String(), Type.Null()]),
  metacriticScore: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  openCriticScore: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  criticScore: Type.Union([Type.Number({ minimum: 0, maximum: 100, description: "IGDB aggregated critic score based on at least three reviews" }), Type.Null()]),
  popularityScore: Type.Union([Type.Number({ minimum: 0, maximum: 1, description: "Relative catalog popularity, not a review rating" }), Type.Null()]),
  completionTimes: GameCompletionTimesSchema,
  completionReports: Type.Array(CompletionReportSchema),
  completionSummary: CompletionSummarySchema,
  completionMasterSummary: CompletionSummarySchema,
  hltbMainHours: Type.Union([Type.String(), Type.Null()]),
  hltbMainExtraHours: Type.Union([Type.String(), Type.Null()]),
  hltbCompletionistHours: Type.Union([Type.String(), Type.Null()]),
});
export type PublicGameCard = Static<typeof GameCardSchema>;

export const ListGamesResponseSchema = Type.Object({
  items: Type.Array(GameCardSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListGamesResponse = Static<typeof ListGamesResponseSchema>;
