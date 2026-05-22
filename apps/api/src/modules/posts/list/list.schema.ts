import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../dashboard/create/create.schema";

export const ListPostsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
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
