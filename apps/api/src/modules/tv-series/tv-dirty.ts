import { and, eq, isNotNull, sql } from "drizzle-orm";
import { recurringJobs, tvSearchDirty, tvSearchState } from "@vefacaglar/db";
import type { DbProvider } from "../../db.provider";

/** Source writers call this inside their existing DbProvider transaction. */
export async function dirtyTvSearch(db: DbProvider["client"], seriesIds: number[]) {
  for (let offset = 0; offset < seriesIds.length; offset += 500) {
    await db.insert(tvSearchDirty).values([...new Set(seriesIds.slice(offset, offset + 500))].map((seriesId) => ({ seriesId })))
      .onConflictDoUpdate({ target: tvSearchDirty.seriesId, set: { revision: sql`${tvSearchDirty.revision}+1` } });
  }
  await db.update(tvSearchState).set({ rankingReady: false }).where(eq(tvSearchState.id, "tv_series_en"));
  const [registration] = await db.select({ id: recurringJobs.id }).from(recurringJobs)
    .where(and(eq(recurringJobs.id, "search.tv-series.sync"), eq(recurringJobs.type, "search.tv-series.sync"),
      eq(recurringJobs.enabled, true), isNotNull(recurringJobs.cron))).for("no key update");
  if (registration) {
    await db.execute(sql`update ${recurringJobs} set next_run_at=clock_timestamp(),updated_at=clock_timestamp()
      where id=${registration.id} and (next_run_at is null or next_run_at>clock_timestamp())`);
    await db.execute(sql`select pg_notify('jobs',${registration.id})`);
  }
}
