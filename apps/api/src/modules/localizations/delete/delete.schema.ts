import { Type, Static } from "@sinclair/typebox";

export const LocalizationFieldSchema = Type.Union([
  Type.Literal("title"),
  Type.Literal("excerpt"),
  Type.Literal("content"),
  Type.Literal("seoTitle"),
  Type.Literal("seoDescription"),
  Type.Literal("summary"),
]);

export const DeleteLocalizationQuerySchema = Type.Object({
  entityType: Type.Union([
    Type.Literal("page"),
    Type.Literal("post"),
    Type.Literal("project"),
  ]),
  entityId: Type.String({ format: "uuid" }),
  languageCode: Type.Literal("tr"),
  field: Type.Optional(LocalizationFieldSchema),
});

export type DeleteLocalizationQuery = Static<typeof DeleteLocalizationQuerySchema>;

export const DeleteLocalizationResponseSchema = Type.Object({
  success: Type.Boolean(),
  deletedCount: Type.Integer({ minimum: 0 }),
});

export type DeleteLocalizationResponse = Static<typeof DeleteLocalizationResponseSchema>;
