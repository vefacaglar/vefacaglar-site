import { eq, sql } from "drizzle-orm";
import { tvSearchDirty, tvSearchState } from "@vefacaglar/db";
import type { DbProvider } from "../../db.provider";

/** Source writers call this inside their existing DbProvider transaction. */
export async function dirtyTvSearch(db: DbProvider["client"], seriesIds: number[]) {
  for (let offset = 0; offset < seriesIds.length; offset += 500) {
    await db.insert(tvSearchDirty).values([...new Set(seriesIds.slice(offset, offset + 500))].map((seriesId) => ({ seriesId })))
      .onConflictDoUpdate({ target: tvSearchDirty.seriesId, set: { revision: sql`${tvSearchDirty.revision}+1` } });
  }
  await db.update(tvSearchState).set({ rankingReady: false }).where(eq(tvSearchState.id, "tv_series_en"));
}
