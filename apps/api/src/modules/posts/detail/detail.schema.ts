import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../create/create.schema";

export const GetPostParamsSchema = Type.Object({
  slug: Type.String(),
});

export type GetPostParams = Static<typeof GetPostParamsSchema>;

export const GetPostResponseSchema = PostResponseSchema;

export type GetPostResponse = Static<typeof GetPostResponseSchema>;
