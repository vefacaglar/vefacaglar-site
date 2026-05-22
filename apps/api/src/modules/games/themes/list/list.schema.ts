import { Type, Static } from "@sinclair/typebox";

export const ListThemesQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});

export type ListThemesQuery = Static<typeof ListThemesQuerySchema>;

export const ThemeResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
});

export const ListThemesResponseSchema = Type.Object({
  items: Type.Array(ThemeResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});

export type ListThemesResponse = Static<typeof ListThemesResponseSchema>;
export type ThemeResponse = Static<typeof ThemeResponseSchema>;
