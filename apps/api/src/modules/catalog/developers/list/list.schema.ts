import { Type, Static } from "@sinclair/typebox";

export const ListDevelopersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  // Typesense rejects per_page above 250.
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
  q: Type.Optional(Type.String()),
});

export type ListDevelopersQuery = Static<typeof ListDevelopersQuerySchema>;

export const DeveloperResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  countryCode: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
});

export const ListDevelopersResponseSchema = Type.Object({
  items: Type.Array(DeveloperResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});

export type ListDevelopersResponse = Static<typeof ListDevelopersResponseSchema>;
export type DeveloperResponse = Static<typeof DeveloperResponseSchema>;
