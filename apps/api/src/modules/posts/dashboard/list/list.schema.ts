import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../create/create.schema";

export const ListAdminPostsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});
export type ListAdminPostsQuery = Static<typeof ListAdminPostsQuerySchema>;

export const ListAdminPostsResponseSchema = Type.Object({
  items: Type.Array(PostResponseSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListAdminPostsResponse = Static<typeof ListAdminPostsResponseSchema>;
