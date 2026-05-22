import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../create/create.schema";

export const ListAdminPostsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
});
export type ListAdminPostsQuery = Static<typeof ListAdminPostsQuerySchema>;

export const ListAdminPostsResponseSchema = Type.Array(PostResponseSchema);
export type ListAdminPostsResponse = Static<typeof ListAdminPostsResponseSchema>;
