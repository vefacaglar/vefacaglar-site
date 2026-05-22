import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../dashboard/create/create.schema";

export const ListPostsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
});

export type ListPostsQuery = Static<typeof ListPostsQuerySchema>;

export const ListPostsResponseSchema = Type.Array(PostResponseSchema);

export type ListPostsResponse = Static<typeof ListPostsResponseSchema>;
