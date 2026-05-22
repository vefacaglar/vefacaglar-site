import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../dashboard/create/create.schema";

export const ListProjectsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  page: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});

export type ListProjectsQuery = Static<typeof ListProjectsQuerySchema>;

export const ListProjectsResponseSchema = Type.Object({
  items: Type.Array(ProjectResponseSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});

export type ListProjectsResponse = Static<typeof ListProjectsResponseSchema>;
