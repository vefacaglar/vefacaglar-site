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
  durationMs: Type.Number(),
});
export type RefreshPopularityResponse = Static<typeof RefreshPopularityResponseSchema>;
