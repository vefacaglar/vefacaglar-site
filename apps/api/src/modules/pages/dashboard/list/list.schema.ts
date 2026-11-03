import { Type, Static } from "@sinclair/typebox";
import { PageResponseSchema } from "../create/create.schema";

export const ListAdminPagesQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
});
export type ListAdminPagesQuery = Static<typeof ListAdminPagesQuerySchema>;

export const ListAdminPagesResponseSchema = Type.Object({
  items: Type.Array(PageResponseSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListAdminPagesResponse = Static<typeof ListAdminPagesResponseSchema>;
