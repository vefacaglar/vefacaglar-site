import { Type, Static } from "@sinclair/typebox";

export const RefreshPopularityResponseSchema = Type.Object({
  rankingVersion: Type.String(),
  seriesAdjustedCount: Type.Number(),
  audienceCount: Type.Number(),
  audienceRequests: Type.Number(),
  audienceStatus: Type.Union([Type.Literal("complete"), Type.Literal("partial"), Type.Literal("unavailable")]),
  /** Games linked to IGDB that were considered. */
  gameCount: Type.Number(),
  /** Missing current leaders added to the catalog during this run. */
  discoveredCount: Type.Number(),
  /** IGDB popularity primitives stored. */
  signalCount: Type.Number(),
  /** Games that ended up with a non-null score. */
  scoredCount: Type.Number(),
  /** Games whose score changed and were sent to the search index. */
  reindexedCount: Type.Number(),
  recommendationScoredCount: Type.Number(),
  gameModesCheckedCount: Type.Number(),
  gameModesStatus: Type.Union([Type.Literal("complete"), Type.Literal("budget"), Type.Literal("unavailable")]),
  durationMs: Type.Number(),
});
export type RefreshPopularityResponse = Static<typeof RefreshPopularityResponseSchema>;
