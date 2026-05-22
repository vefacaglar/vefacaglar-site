import { Type, Static } from "@sinclair/typebox";

export const UpsertLocalizationRequestSchema = Type.Object({
  entityType: Type.Union([
    Type.Literal("page"),
    Type.Literal("post"),
    Type.Literal("project"),
  ]),
  entityId: Type.String({ minLength: 1 }),
  languageCode: Type.Literal("tr"),
  field: Type.String({ minLength: 1 }),
  value: Type.String({ minLength: 1 }),
});

export type UpsertLocalizationRequest = Static<typeof UpsertLocalizationRequestSchema>;

export const UpsertLocalizationResponseSchema = Type.Object({
  id: Type.String(),
  entityType: Type.String(),
  entityId: Type.String(),
  languageCode: Type.String(),
  field: Type.String(),
  value: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export type UpsertLocalizationResponse = Static<typeof UpsertLocalizationResponseSchema>;
