import { Type, Static } from "@sinclair/typebox";
import { ThemeResponseSchema } from "../list/list.schema";

export const GetThemeParamsSchema = Type.Object({
  id: Type.String(),
});

export type GetThemeParams = Static<typeof GetThemeParamsSchema>;
export type ThemeResponse = Static<typeof ThemeResponseSchema>;
export { ThemeResponseSchema };
