import { Type, Static } from "@sinclair/typebox";

export const CreateProjectRequestSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  summary: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  featured: Type.Optional(Type.Boolean()),
  sortOrder: Type.Optional(Type.Integer()),
  githubUrl: Type.Optional(Type.String()),
  liveUrl: Type.Optional(Type.String()),
  coverImageUrl: Type.Optional(Type.String()),
  seoTitle: Type.Optional(Type.String()),
  seoDescription: Type.Optional(Type.String()),
  startedAt: Type.Optional(Type.String()),
  endedAt: Type.Optional(Type.String()),
});

export type CreateProjectRequest = Static<typeof CreateProjectRequestSchema>;

export const ProjectResponseSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  title: Type.String(),
  summary: Type.String(),
  content: Type.Optional(Type.String()),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  featured: Type.Boolean(),
  sortOrder: Type.Integer(),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  liveUrl: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  seoTitle: Type.Union([Type.String(), Type.Null()]),
  seoDescription: Type.Union([Type.String(), Type.Null()]),
  startedAt: Type.Union([Type.String(), Type.Null()]),
  endedAt: Type.Union([Type.String(), Type.Null()]),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type ProjectResponse = Static<typeof ProjectResponseSchema>;
