import { Type, Static } from "@sinclair/typebox";
import { PackageResponseSchema } from "../create/create.schema";

export const ListAdminPackagesQuerySchema = Type.Object({
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
  q: Type.Optional(Type.String()),
});
export type ListAdminPackagesQuery = Static<typeof ListAdminPackagesQuerySchema>;

export const ListAdminPackagesResponseSchema = Type.Object({
  items: Type.Array(PackageResponseSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListAdminPackagesResponse = Static<typeof ListAdminPackagesResponseSchema>;
