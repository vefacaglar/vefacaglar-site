import { Type, Static } from "@sinclair/typebox";

export const ListPlatformsQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
  q: Type.Optional(Type.String()),
});

export type ListPlatformsQuery = Static<typeof ListPlatformsQuerySchema>;

export const PlatformResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
});

export const ListPlatformsResponseSchema = Type.Object({
  items: Type.Array(PlatformResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});

export type ListPlatformsResponse = Static<typeof ListPlatformsResponseSchema>;
export type PlatformResponse = Static<typeof PlatformResponseSchema>;
