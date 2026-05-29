import { Type, Static } from "@sinclair/typebox";
import { PackageResponseSchema } from "../create/create.schema";

export const GetAdminPackageParamsSchema = Type.Object({
  id: Type.String(),
});
export type GetAdminPackageParams = Static<typeof GetAdminPackageParamsSchema>;

export const GetAdminPackageResponseSchema = PackageResponseSchema;
export type GetAdminPackageResponse = Static<typeof GetAdminPackageResponseSchema>;
