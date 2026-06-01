import { Type, Static } from "@sinclair/typebox";

export const GetPackageParamsSchema = Type.Object({
  slug: Type.String(),
});
export type GetPackageParams = Static<typeof GetPackageParamsSchema>;

export const PublicDocCategorySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  displayOrder: Type.Number(),
});

export const PublicDocItemSchema = Type.Object({
  id: Type.String(),
  categoryId: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  displayOrder: Type.Number(),
});

export const PublicPackageItemSchema = Type.Object({
  id: Type.String(),
  groupId: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  nugetUrl: Type.Union([Type.String(), Type.Null()]),
  npmUrl: Type.Union([Type.String(), Type.Null()]),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  latestVersion: Type.String(),
  isActive: Type.Boolean(),
});

export const GetPackageResponseSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  nugetUrl: Type.Union([Type.String(), Type.Null()]),
  npmUrl: Type.Union([Type.String(), Type.Null()]),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  docs: Type.Union([Type.String(), Type.Null()]),
  latestVersion: Type.String(),
  content: Type.String(),
  packages: Type.Array(PublicPackageItemSchema),
  categories: Type.Array(PublicDocCategorySchema),
  docsList: Type.Array(PublicDocItemSchema),
});
export type GetPackageResponse = Static<typeof GetPackageResponseSchema>;
