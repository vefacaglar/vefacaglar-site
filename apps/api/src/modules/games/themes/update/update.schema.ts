import { Type, Static } from "@sinclair/typebox";
import { ThemeResponseSchema } from "../list/list.schema";

export const UpdateThemeParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdateThemeRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
});

export type UpdateThemeParams = Static<typeof UpdateThemeParamsSchema>;
export type UpdateThemeRequest = Static<typeof UpdateThemeRequestSchema>;
export type ThemeResponse = Static<typeof ThemeResponseSchema>;
export { ThemeResponseSchema };
