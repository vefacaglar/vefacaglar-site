import { Type, Static } from "@sinclair/typebox";
import { PostResponseSchema } from "../create/create.schema";

export const UpdatePostParamsSchema = Type.Object({
  id: Type.String(),
});

export type UpdatePostParams = Static<typeof UpdatePostParamsSchema>;

export const UpdatePostRequestSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  excerpt: Type.Optional(Type.String()),
  content: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  coverImageUrl: Type.Optional(Type.String()),
  seoTitle: Type.Optional(Type.String()),
  seoDescription: Type.Optional(Type.String()),
});

export type UpdatePostRequest = Static<typeof UpdatePostRequestSchema>;

export const UpdatePostResponseSchema = PostResponseSchema;

export type UpdatePostResponse = Static<typeof UpdatePostResponseSchema>;
