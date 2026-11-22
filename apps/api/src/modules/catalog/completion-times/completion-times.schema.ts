import { Type, type Static } from "@sinclair/typebox";

const NullableSeconds = Type.Union([Type.Integer({ minimum: 1, maximum: 3600000 }), Type.Null()]);
export const GameCompletionTimesSchema = Type.Union([Type.Object({
  creditsSeconds: NullableSeconds,
  extrasSeconds: NullableSeconds,
  completionistSeconds: NullableSeconds,
  sampleCount: Type.Integer({ minimum: 1 }),
  source: Type.Literal("IGDB"),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
}), Type.Null()]);
export type PublicGameCompletionTimes = Static<typeof GameCompletionTimesSchema>;
