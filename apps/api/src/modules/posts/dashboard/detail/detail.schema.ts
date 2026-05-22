import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../create/create.schema";

export const GetAdminPostParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetAdminPostParams = Static<typeof GetAdminPostParamsSchema>;

export const GetAdminPostResponseSchema = PostResponseSchema;

export type GetAdminPostResponse = Static<typeof GetAdminPostResponseSchema>;
