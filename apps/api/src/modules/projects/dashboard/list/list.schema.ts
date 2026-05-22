import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../create/create.schema";

export const ListAdminProjectsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
});
export type ListAdminProjectsQuery = Static<typeof ListAdminProjectsQuerySchema>;

export const ListAdminProjectsResponseSchema = Type.Array(ProjectResponseSchema);
export type ListAdminProjectsResponse = Static<typeof ListAdminProjectsResponseSchema>;
