import { Type, Static } from "@sinclair/typebox";

export const CreatePageRequestSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  seoTitle: Type.Optional(Type.String()),
  seoDescription: Type.Optional(Type.String()),
});

export type CreatePageRequest = Static<typeof CreatePageRequestSchema>;

export const PageResponseSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  content: Type.String(),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  seoTitle: Type.Union([Type.String(), Type.Null()]),
  seoDescription: Type.Union([Type.String(), Type.Null()]),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type PageResponse = Static<typeof PageResponseSchema>;
