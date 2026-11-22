import { Type } from "@sinclair/typebox";

const NullableSeconds = Type.Union([Type.Integer({ minimum: 1, maximum: 3600000 }), Type.Null()]);
export const CompletionReportSchema = Type.Object({
  provider: Type.Union([Type.Literal("backloggd"), Type.Literal("ifdb"), Type.Literal("vndb")]),
  sourceUrl: Type.String(), scope: Type.String(),
  statistic: Type.Union([Type.Literal("reported"), Type.Literal("median_finish"), Type.Literal("average_playtime")]),
  finishSeconds: NullableSeconds, masterSeconds: NullableSeconds, playtimeSeconds: NullableSeconds,
  sampleCount: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  sourceUpdatedAt: Type.Union([Type.String(), Type.Null()]), fetchedAt: Type.String(),
});
export const CompletionSummarySchema = Type.Union([Type.Null(), Type.Object({
  kind: Type.Union([Type.Literal("single"), Type.Literal("agreement"), Type.Literal("range")]),
  estimateSeconds: NullableSeconds,
  lowerSeconds: Type.Integer({ minimum: 1, maximum: 3600000 }), upperSeconds: Type.Integer({ minimum: 1, maximum: 3600000 }),
  providers: Type.Array(Type.String()), excludedProviders: Type.Array(Type.String()),
})]);
