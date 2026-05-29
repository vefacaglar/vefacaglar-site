import { Type, Static } from "@sinclair/typebox";

export const ListPackagesQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
  q: Type.Optional(Type.String()),
});
export type ListPackagesQuery = Static<typeof ListPackagesQuerySchema>;

export const PublicPackageItemSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  nugetUrl: Type.Union([Type.String(), Type.Null()]),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  docs: Type.Union([Type.String(), Type.Null()]),
  latestVersion: Type.String(),
});

export const ListPackagesResponseSchema = Type.Object({
  items: Type.Array(PublicPackageItemSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListPackagesResponse = Static<typeof ListPackagesResponseSchema>;
