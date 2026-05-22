import { Type, Static } from "@sinclair/typebox";
import { PageResponseSchema } from "../../create/create.schema";

export const GetAdminPageParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetAdminPageParams = Static<typeof GetAdminPageParamsSchema>;

export const GetAdminPageResponseSchema = PageResponseSchema;

export type GetAdminPageResponse = Static<typeof GetAdminPageResponseSchema>;
