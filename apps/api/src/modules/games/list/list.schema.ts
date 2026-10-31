import { Type, Static } from "@sinclair/typebox";

export const ListGamesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 48 })),
  q: Type.Optional(Type.String({ maxLength: 100 })),
});
export type ListGamesQuery = Static<typeof ListGamesQuerySchema>;

export const GameCardSchema = Type.Object({
  slug: Type.String(),
  title: Type.String(),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  releaseDate: Type.Union([Type.String(), Type.Null()]),
});

export const ListGamesResponseSchema = Type.Object({
  items: Type.Array(GameCardSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListGamesResponse = Static<typeof ListGamesResponseSchema>;
