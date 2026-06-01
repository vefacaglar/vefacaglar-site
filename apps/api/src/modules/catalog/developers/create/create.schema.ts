import { Type, Static } from "@sinclair/typebox";
import { DeveloperResponseSchema } from "../list/list.schema";

export const CreateDeveloperRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
  countryCode: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
});

export type CreateDeveloperRequest = Static<typeof CreateDeveloperRequestSchema>;
export type DeveloperResponse = Static<typeof DeveloperResponseSchema>;
export { DeveloperResponseSchema };
