import { Type, Static } from "@sinclair/typebox";

export const GetPackageItemParamsSchema = Type.Object({
  groupSlug: Type.String(),
  packageSlug: Type.String(),
});
export type GetPackageItemParams = Static<typeof GetPackageItemParamsSchema>;

export const GetPackageItemResponseSchema = Type.Object({
  id: Type.String(),
  groupId: Type.String(),
  groupSlug: Type.String(),
  groupName: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  nugetUrl: Type.Union([Type.String(), Type.Null()]),
  npmUrl: Type.Union([Type.String(), Type.Null()]),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  latestVersion: Type.String(),
  content: Type.String(),
});
export type GetPackageItemResponse = Static<typeof GetPackageItemResponseSchema>;
