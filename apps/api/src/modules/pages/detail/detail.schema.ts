import { Type, Static } from "@sinclair/typebox";
import { PageResponseSchema } from "../create/create.schema";

export const GetPageParamsSchema = Type.Object({
  slug: Type.String(),
});

export type GetPageParams = Static<typeof GetPageParamsSchema>;

export const GetPageResponseSchema = PageResponseSchema;

export type GetPageResponse = Static<typeof GetPageResponseSchema>;
