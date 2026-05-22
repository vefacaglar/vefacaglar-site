import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../create/create.schema";

export const UpdateProjectParamsSchema = Type.Object({
  id: Type.String(),
});

export type UpdateProjectParams = Static<typeof UpdateProjectParamsSchema>;

export const UpdateProjectRequestSchema = Type.Object({
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

export type UpdateProjectRequest = Static<typeof UpdateProjectRequestSchema>;

export const UpdateProjectResponseSchema = ProjectResponseSchema;

export type UpdateProjectResponse = Static<typeof UpdateProjectResponseSchema>;
