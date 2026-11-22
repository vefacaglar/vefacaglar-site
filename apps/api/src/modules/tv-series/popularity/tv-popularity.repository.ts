import { guardTvCampaign } from "../daily/tv-campaign";
import { injectable } from "tsyringe";
import { eq, sql } from "drizzle-orm";
import { tvPopularityState, tvPopularityScores, tvSeries, tvRefreshQueue } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import { dirtyTvSearch } from "../tv-dirty";
import type { ITvPopularityRepository, TvIdentity, TvPopularitySnapshot } from "./tv-popularity.types";
@injectable()
export class DrizzleTvPopularityRepository implements ITvPopularityRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() {
    const [state] = await this.dbProvider.client.select().from(tvPopularityState).where(eq(tvPopularityState.id, "current"));
    if (!state) throw new Error("tv_popularity_state_missing_migration");
    return state;
  }
  async identities(rows: TvIdentity[], at: Date) {
    await this.dbProvider.client.update(tvPopularityState).set({ identityMap: rows, identitiesCheckedAt: at }).where(eq(tvPopularityState.id, "current"));
  }
  async cooldown(until: Date) {
    await this.dbProvider.client.update(tvPopularityState).set({ cooldownUntil: until }).where(eq(tvPopularityState.id, "current"));
  }
  async publish(snapshot: TvPopularitySnapshot, at: Date) {
    if (!snapshot.scores.length || snapshot.scores.some((row) => !Number.isFinite(row.score) || row.score < 0)) throw new Error("tv_popularity_empty_publication");
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [state] = await db.select().from(tvPopularityState).where(eq(tvPopularityState.id, "current")).for("update");
      if (!state) throw new Error("tv_popularity_state_missing_migration");
      const generation = state.generation + 1;
      await db.delete(tvPopularityScores);
      for (let offset = 0; offset < snapshot.scores.length; offset += 1000) await db.insert(tvPopularityScores).values(snapshot.scores.slice(offset, offset + 1000).map((row) => ({ ...row, generation })));
      await db.execute(sql`update ${tvSeries} t set popularity_score=p.score,popularity_generation=${generation} from ${tvPopularityScores} p where p.series_id=t.id`);
      await db.execute(sql`update ${tvSeries} t set popularity_score=null,popularity_generation=${generation} where not exists(select 1 from ${tvPopularityScores} p where p.series_id=t.id)`);
      await db.update(tvPopularityState).set({ generation, publishedAt: at, sources: snapshot.sources, cooldownUntil: null }).where(eq(tvPopularityState.id, "current"));
      const all = await db.select({ id: tvSeries.id }).from(tvSeries);
      await dirtyTvSearch(db, all.map((row) => row.id));
      // Prioritize current leaders even while the first full index is advancing.
      const hot = snapshot.scores.slice().sort((a, b) => b.score - a.score || a.seriesId - b.seriesId).slice(0, 1000);
      const queued = await db.execute(sql`insert into ${tvRefreshQueue}(series_id,priority,requested_at,due_at)
        select p.series_id,100,${at.toISOString()}::timestamptz,${at.toISOString()}::timestamptz from ${tvPopularityScores} p
        left join ${tvSeries} t on t.id=p.series_id where p.series_id in (${sql.join(hot.map((row) => sql`${row.seriesId}`), sql`,`)})
        and (t.id is null or not t.hierarchy_complete or t.hierarchy_updated_at<${new Date(at.getTime() - 86400_000).toISOString()}::timestamptz)
        on conflict(series_id) do update set priority=100,requested_at=greatest(tv_refresh_queue.requested_at+interval '1 microsecond',clock_timestamp(),excluded.requested_at),due_at=excluded.due_at returning series_id`);
      const accepted = new Set(snapshot.scores.map((row) => row.seriesId));
      await guardTvCampaign(db,true);
      return { generation, matched: all.filter((row) => accepted.has(row.id)).length, queued: queued.length };
    });
  }
}
