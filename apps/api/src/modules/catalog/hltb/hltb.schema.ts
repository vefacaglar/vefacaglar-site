import { Type, type Static } from "@sinclair/typebox";
export const HoursSchema = Type.Object({ mainHours: Type.Union([Type.Number(), Type.Null()]), mainExtraHours: Type.Union([Type.Number(), Type.Null()]), completionistHours: Type.Union([Type.Number(), Type.Null()]) });
export const HltbGameSchema = Type.Object({
  id: Type.String({ format: "uuid" }), title: Type.String(), releaseYear: Type.Union([Type.Integer(), Type.Null()]),
  hltbId: Type.Union([Type.Integer(), Type.Null()]), mappingSource: Type.Union([Type.String(), Type.Null()]), times: HoursSchema,
});
export const HltbParamsSchema = Type.Object({ id: Type.String({ format: "uuid" }) });
export type HltbParams = Static<typeof HltbParamsSchema>;
