import { Type, Static } from "@sinclair/typebox";

export const ListPublishersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  // Bounded page size for dashboard lists (and the search page size).
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
  q: Type.Optional(Type.String({ maxLength: 100 })),
});

export type ListPublishersQuery = Static<typeof ListPublishersQuerySchema>;

export const PublisherResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  countryCode: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
});

export const ListPublishersResponseSchema = Type.Object({
  items: Type.Array(PublisherResponseSchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
  totalPages: Type.Integer(),
});

export type ListPublishersResponse = Static<typeof ListPublishersResponseSchema>;
export type PublisherResponse = Static<typeof PublisherResponseSchema>;
