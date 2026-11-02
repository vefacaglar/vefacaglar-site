import { Type, Static } from "@sinclair/typebox";

export const ListPublishersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  // Typesense rejects per_page above 250.
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
  q: Type.Optional(Type.String()),
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
