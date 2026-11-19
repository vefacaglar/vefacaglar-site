import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../dashboard/create/create.schema";

export const ListPostsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  // Bounded page size for dashboard lists (and the search page size).
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
  q: Type.Optional(Type.String({ maxLength: 100 })),
});

export type ListPostsQuery = Static<typeof ListPostsQuerySchema>;

export const ListPostsResponseSchema = Type.Object({
  items: Type.Array(PostResponseSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});

export type ListPostsResponse = Static<typeof ListPostsResponseSchema>;
