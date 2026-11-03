import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../create/create.schema";

export const ListAdminProjectsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
});
export type ListAdminProjectsQuery = Static<typeof ListAdminProjectsQuerySchema>;

export const ListAdminProjectsResponseSchema = Type.Object({
  items: Type.Array(ProjectResponseSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
export type ListAdminProjectsResponse = Static<typeof ListAdminProjectsResponseSchema>;
