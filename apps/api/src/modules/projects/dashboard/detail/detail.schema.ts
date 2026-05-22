import { Type, Static } from "@sinclair/typebox";
import { ProjectResponseSchema } from "../create/create.schema";

export const GetAdminProjectParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetAdminProjectParams = Static<typeof GetAdminProjectParamsSchema>;

export const GetAdminProjectResponseSchema = ProjectResponseSchema;

export type GetAdminProjectResponse = Static<typeof GetAdminProjectResponseSchema>;
