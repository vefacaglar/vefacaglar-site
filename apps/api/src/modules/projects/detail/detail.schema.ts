import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../create/create.schema";

export const GetProjectParamsSchema = Type.Object({
  slug: Type.String(),
});

export type GetProjectParams = Static<typeof GetProjectParamsSchema>;

export const GetProjectResponseSchema = ProjectResponseSchema;

export type GetProjectResponse = Static<typeof GetProjectResponseSchema>;
