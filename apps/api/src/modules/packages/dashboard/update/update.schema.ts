import { Type, Static } from "@sinclair/typebox";
import { PackageResponseSchema } from "../create/create.schema";

export const UpdatePackageParamsSchema = Type.Object({
  id: Type.String(),
});
export type UpdatePackageParams = Static<typeof UpdatePackageParamsSchema>;

export const UpdatePackageRequestSchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  nugetUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  githubUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  docs: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  latestVersion: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
  content: Type.Optional(Type.String()),
});
export type UpdatePackageRequest = Static<typeof UpdatePackageRequestSchema>;

export const UpdatePackageResponseSchema = PackageResponseSchema;
export type UpdatePackageResponse = Static<typeof UpdatePackageResponseSchema>;
