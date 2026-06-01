import { Type, Static } from "@sinclair/typebox";

export const CreatePackageRequestSchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  nugetUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  npmUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  githubUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  docs: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  latestVersion: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  content: Type.Optional(Type.String()),
});
export type CreatePackageRequest = Static<typeof CreatePackageRequestSchema>;

export const PackageResponseSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  nugetUrl: Type.Union([Type.String(), Type.Null()]),
  npmUrl: Type.Union([Type.String(), Type.Null()]),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  docs: Type.Union([Type.String(), Type.Null()]),
  latestVersion: Type.String(),
  isActive: Type.Boolean(),
  packageCount: Type.Optional(Type.Number()),
  content: Type.Optional(Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export type PackageResponse = Static<typeof PackageResponseSchema>;
