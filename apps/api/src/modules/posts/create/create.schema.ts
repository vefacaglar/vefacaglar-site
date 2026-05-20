import { Type, Static } from "@sinclair/typebox";

export const CreatePostRequestSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  excerpt: Type.Optional(Type.String()),
  content: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  coverImageUrl: Type.Optional(Type.String()),
  seoTitle: Type.Optional(Type.String()),
  seoDescription: Type.Optional(Type.String()),
});

export type CreatePostRequest = Static<typeof CreatePostRequestSchema>;

export const PostResponseSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  excerpt: Type.Union([Type.String(), Type.Null()]),
  content: Type.String(),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  seoTitle: Type.Union([Type.String(), Type.Null()]),
  seoDescription: Type.Union([Type.String(), Type.Null()]),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type PostResponse = Static<typeof PostResponseSchema>;
