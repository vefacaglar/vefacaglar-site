import { Type, Static } from "@sinclair/typebox";
import { PublicDocCategorySchema, PublicDocItemSchema } from "../detail/detail.schema";

export const GetDocParamsSchema = Type.Object({
  slug: Type.String(),
  docSlug: Type.String(),
});
export type GetDocParams = Static<typeof GetDocParamsSchema>;

export const GetDocResponseSchema = Type.Object({
  id: Type.String(),
  groupId: Type.String(),
  categoryId: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  filePath: Type.Union([Type.String(), Type.Null()]),
  content: Type.String(),
  displayOrder: Type.Number(),
  categories: Type.Array(PublicDocCategorySchema),
  docsList: Type.Array(PublicDocItemSchema),
});
export type GetDocResponse = Static<typeof GetDocResponseSchema>;
