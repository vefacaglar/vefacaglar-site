import { Type, type Static } from "@sinclair/typebox";
import { HltbGameSchema, HoursSchema } from "../hltb.schema";
export const HltbLookupBodySchema = Type.Object({ query: Type.Optional(Type.String({ minLength: 1, maxLength: 250 })), refresh: Type.Optional(Type.Boolean()) }, { additionalProperties: false });
export type HltbLookupBody = Static<typeof HltbLookupBodySchema>;
export const HltbLookupResponseSchema = Type.Object({
  game: HltbGameSchema, expectedVersion: Type.String(), receiptId: Type.String({ format: "uuid" }), query: Type.String(),
  outcome: Type.Union([Type.Literal("matches"), Type.Literal("no_match"), Type.Literal("provider_unavailable")]),
  candidates: Type.Array(Type.Object({ hltbId: Type.Integer(), title: Type.String(), releaseYear: Type.Union([Type.Integer(), Type.Null()]), times: HoursSchema, sourceUrl: Type.String(), warnings: Type.Array(Type.String()) })),
  expiresAt: Type.String(), retryAfter: Type.Union([Type.String(), Type.Null()]), cached: Type.Boolean(), pendingSearchSync: Type.Boolean(),
});
