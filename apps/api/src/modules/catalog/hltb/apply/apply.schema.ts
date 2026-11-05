import { Type, type Static } from "@sinclair/typebox";
import { HltbGameSchema } from "../hltb.schema";
export const HltbApplyBodySchema = Type.Object({
  receiptId: Type.String({ format: "uuid" }), hltbId: Type.Integer({ minimum: 1, maximum: 2147483647 }), expectedVersion: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  overwriteFields: Type.Optional(Type.Array(Type.Union([Type.Literal("mainHours"), Type.Literal("mainExtraHours"), Type.Literal("completionistHours")]), { maxItems: 3, uniqueItems: true })),
  replaceMapping: Type.Optional(Type.Boolean()), acknowledgeMismatch: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });
export type HltbApplyBody = Static<typeof HltbApplyBodySchema>;
export const HltbApplyResponseSchema = Type.Object({ game: HltbGameSchema, searchSync: Type.Union([Type.Literal("synced"), Type.Literal("pending")]) });
