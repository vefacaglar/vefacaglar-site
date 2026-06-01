import { Type, Static } from "@sinclair/typebox";

export const ListPublishersQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
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
