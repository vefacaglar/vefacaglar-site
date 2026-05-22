import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../create/create.schema";

export const ListProjectsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
});

export type ListProjectsQuery = Static<typeof ListProjectsQuerySchema>;

export const ListProjectsResponseSchema = Type.Array(ProjectResponseSchema);

export type ListProjectsResponse = Static<typeof ListProjectsResponseSchema>;
