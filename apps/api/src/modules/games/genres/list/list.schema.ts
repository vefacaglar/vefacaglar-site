import { Type, Static } from "@sinclair/typebox";

export const ListGenresQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
  q: Type.Optional(Type.String()),
});

export type ListGenresQuery = Static<typeof ListGenresQuerySchema>;

export const GenreResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
});

export const ListGenresResponseSchema = Type.Object({
  items: Type.Array(GenreResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});

export type ListGenresResponse = Static<typeof ListGenresResponseSchema>;
export type GenreResponse = Static<typeof GenreResponseSchema>;
