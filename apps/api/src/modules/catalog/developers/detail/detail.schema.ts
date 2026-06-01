import { Type, Static } from "@sinclair/typebox";
import { DeveloperResponseSchema } from "../list/list.schema";

export const GetDeveloperParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetDeveloperParams = Static<typeof GetDeveloperParamsSchema>;
export type DeveloperResponse = Static<typeof DeveloperResponseSchema>;
export { DeveloperResponseSchema };
