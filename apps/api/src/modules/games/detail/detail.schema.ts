import { CompletionReportSchema, CompletionSummarySchema } from "../../catalog/completion-times/completion-sources.schema";
import { Type, Static } from "@sinclair/typebox";
import { GameCompletionTimesSchema } from "../../catalog/completion-times/completion-times.schema";

export const GetGameParamsSchema = Type.Object({ slug: Type.String() });
export type GetGameParams = Static<typeof GetGameParamsSchema>;

const NamedSchema = Type.Object({ name: Type.String(), slug: Type.String() });
const NullableNumber = Type.Union([Type.Number(), Type.Null()]);

export const GameDetailResponseSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  releaseDate: Type.Union([Type.String(), Type.Null()]),
  criticScore: NullableNumber,
  criticScoreCount: NullableNumber,
  completionTimes: GameCompletionTimesSchema,
  completionReports: Type.Array(CompletionReportSchema),
  completionSummary: CompletionSummarySchema,
  completionMasterSummary: CompletionSummarySchema,
  hltbMainHours: NullableNumber,
  hltbMainExtraHours: NullableNumber,
  hltbCompletionistHours: NullableNumber,
  developers: Type.Array(NamedSchema),
  publishers: Type.Array(NamedSchema),
  genres: Type.Array(NamedSchema),
  themes: Type.Array(NamedSchema),
  // Platforms carry their id so the log form can offer them as choices.
  platforms: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), slug: Type.String() })),
});
export type GameDetailResponse = Static<typeof GameDetailResponseSchema>;
