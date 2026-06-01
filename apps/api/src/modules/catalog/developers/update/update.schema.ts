import { Type, Static } from "@sinclair/typebox";
import { DeveloperResponseSchema } from "../list/list.schema";

export const UpdateDeveloperParamsSchema = Type.Object({
  id: Type.String(),
});

export const UpdateDeveloperRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  slug: Type.Optional(Type.String({ minLength: 1 })),
  countryCode: Type.Optional(Type.Union([Type.String({ minLength: 2, maxLength: 2 }), Type.Null()])),
});

export type UpdateDeveloperParams = Static<typeof UpdateDeveloperParamsSchema>;
export type UpdateDeveloperRequest = Static<typeof UpdateDeveloperRequestSchema>;
export type DeveloperResponse = Static<typeof DeveloperResponseSchema>;
export { DeveloperResponseSchema };
