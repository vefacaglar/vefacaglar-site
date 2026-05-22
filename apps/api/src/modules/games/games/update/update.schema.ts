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
  
  // Relations to update/sync
  developerIds: Type.Optional(Type.Array(Type.String())),
  publisherIds: Type.Optional(Type.Array(Type.String())),
  genreIds: Type.Optional(Type.Array(Type.String())),
  platformIds: Type.Optional(Type.Array(Type.String())),
  themeIds: Type.Optional(Type.Array(Type.String())),
});

export type UpdateGameParams = Static<typeof UpdateGameParamsSchema>;
export type UpdateGameRequest = Static<typeof UpdateGameRequestSchema>;
export type GameResponse = Static<typeof GameResponseSchema>;
export { GameResponseSchema };
