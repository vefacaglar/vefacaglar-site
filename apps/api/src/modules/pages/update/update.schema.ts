import { Type, Static } from "@sinclair/typebox";
import { PageResponseSchema } from "../create/create.schema";

export const UpdatePageParamsSchema = Type.Object({
  id: Type.String(),
});

export type UpdatePageParams = Static<typeof UpdatePageParamsSchema>;

export const UpdatePageRequestSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  seoTitle: Type.Optional(Type.String()),
  seoDescription: Type.Optional(Type.String()),
});

export type UpdatePageRequest = Static<typeof UpdatePageRequestSchema>;

export const UpdatePageResponseSchema = PageResponseSchema;

export type UpdatePageResponse = Static<typeof UpdatePageResponseSchema>;
