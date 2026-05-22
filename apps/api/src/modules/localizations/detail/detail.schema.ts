import { Type, Static } from "@sinclair/typebox";
import { UpsertLocalizationResponseSchema } from "../upsert/upsert.schema";

export const GetLocalizationQuerySchema = Type.Object({
  entityType: Type.Union([
    Type.Literal("page"),
    Type.Literal("post"),
    Type.Literal("project"),
  ]),
  entityId: Type.String({ minLength: 1 }),
  languageCode: Type.Literal("tr"),
  field: Type.String({ minLength: 1 }),
});

export type GetLocalizationQuery = Static<typeof GetLocalizationQuerySchema>;

export const GetLocalizationResponseSchema = Type.Union([
  UpsertLocalizationResponseSchema,
  Type.Null(),
]);

export type GetLocalizationResponse = Static<typeof GetLocalizationResponseSchema>;
