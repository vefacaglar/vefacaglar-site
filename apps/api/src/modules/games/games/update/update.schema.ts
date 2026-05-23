import { Type, Static } from "@sinclair/typebox";
import { GameResponseSchema } from "../list/list.schema";

export const UpdateGameParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdateGameRequestSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  originalTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  coverImageUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  releaseDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metacriticScore: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  openCriticScore: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  hltbMainHours: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
  hltbMainExtraHours: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
  hltbCompletionistHours: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
});

export type UpdateGameParams = Static<typeof UpdateGameParamsSchema>;
export type UpdateGameRequest = Static<typeof UpdateGameRequestSchema>;
export type GameResponse = Static<typeof GameResponseSchema>;
export { GameResponseSchema };
