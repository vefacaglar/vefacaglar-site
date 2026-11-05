import { Type, Static } from "@sinclair/typebox";

export const RefreshPopularityResponseSchema = Type.Object({
  /** Games linked to IGDB that were considered. */
  gameCount: Type.Number(),
  /** IGDB popularity primitives stored. */
  signalCount: Type.Number(),
  /** Games that ended up with a non-null score. */
  scoredCount: Type.Number(),
  /** Games whose score changed and were sent to the search index. */
  reindexedCount: Type.Number(),
  /** HLTB is optional: retained snapshots remain usable when it is unavailable. */
  hltbStatus: Type.Union([Type.Literal("updated"), Type.Literal("unavailable")]),
  hltbFetchedCount: Type.Number(),
  hltbMatchedCount: Type.Number(),
  recommendationScoredCount: Type.Number(),
  gameModesCheckedCount: Type.Number(),
  gameModesStatus: Type.Union([Type.Literal("complete"), Type.Literal("budget"), Type.Literal("unavailable")]),
  durationMs: Type.Number(),
});
export type RefreshPopularityResponse = Static<typeof RefreshPopularityResponseSchema>;
