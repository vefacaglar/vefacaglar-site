import { Type, Static } from "@sinclair/typebox";

export const ListGamesQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});

export type ListGamesQuery = Static<typeof ListGamesQuerySchema>;

export const GameRelationItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
});

export const GameResponseSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  originalTitle: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  releaseDate: Type.Union([Type.String(), Type.Null()]),
  metacriticScore: Type.Union([Type.Integer(), Type.Null()]),
  openCriticScore: Type.Union([Type.Integer(), Type.Null()]),
  hltbMainHours: Type.Union([Type.String(), Type.Null()]),
  hltbMainExtraHours: Type.Union([Type.String(), Type.Null()]),
  hltbCompletionistHours: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
  
  developers: Type.Array(GameRelationItemSchema),
  publishers: Type.Array(GameRelationItemSchema),
  genres: Type.Array(GameRelationItemSchema),
  platforms: Type.Array(GameRelationItemSchema),
  themes: Type.Array(GameRelationItemSchema),
});

export const ListGamesResponseSchema = Type.Object({
  items: Type.Array(GameResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});

export type ListGamesResponse = Static<typeof ListGamesResponseSchema>;
export type GameResponse = Static<typeof GameResponseSchema>;

