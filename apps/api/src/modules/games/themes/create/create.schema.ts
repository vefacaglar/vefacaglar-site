import { Type, Static } from "@sinclair/typebox";
import { ThemeResponseSchema } from "../list/list.schema";

export const CreateThemeRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
});

export type CreateThemeRequest = Static<typeof CreateThemeRequestSchema>;
export type ThemeResponse = Static<typeof ThemeResponseSchema>;
export { ThemeResponseSchema };
