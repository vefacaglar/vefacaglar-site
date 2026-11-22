import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import type { DbProvider } from "../../../db.provider";
export type TvCampaign = { jobId: string; workerId: string; type: string; stage: string; horizon: string; ceiling: number | null };
export const tvCampaignStorage = new AsyncLocalStorage<TvCampaign>();
export function currentTvCampaign() { return tvCampaignStorage.getStore(); }
/** Lock only at the final checkpoint, after lengthy writes, so heartbeat is not blocked by provider/large snapshot work. */
export async function guardTvCampaign(db: DbProvider["client"], lock = false) {
  const campaign = currentTvCampaign(); if (!campaign) return;
  const rows = await db.execute(sql`select id from jobs where id=${campaign.jobId}::uuid and locked_by=${campaign.workerId} and status='running' and not cancel_requested ${lock ? sql`for share` : sql``}`);
  if (!rows.length) throw new Error("tv_job_lease_or_cancellation_changed");
}
export async function finishTvCampaignItem(db: DbProvider["client"], seriesId: number, failed = false) {
  const campaign = currentTvCampaign(); if (!campaign) return;
  await guardTvCampaign(db, true);
  if(failed){
    const rows=await db.execute(sql`update tv_job_campaign_items set failed=true where job_id=${campaign.jobId}::uuid and series_id=${seriesId} and not failed returning series_id`);
    if(rows.length)await db.execute(sql`update tv_job_campaigns set failed=failed+1 where job_id=${campaign.jobId}::uuid`);
  }else{
    const rows=await db.execute(sql`delete from tv_job_campaign_items where job_id=${campaign.jobId}::uuid and series_id=${seriesId} returning series_id`);
    if(rows.length)await db.execute(sql`update tv_job_campaigns set processed=processed+1 where job_id=${campaign.jobId}::uuid`);
  }
}
export async function tvCampaignCandidates(db: DbProvider["client"], kind: "catalog" | "cast", limit: number) {
  const c = currentTvCampaign(); if (!c) return null;
  const queue = kind === "cast" ? sql`tv_cast_queue` : sql`tv_refresh_queue`;
  await guardTvCampaign(db,true);
  await db.execute(sql`delete from tv_job_campaign_items i where i.job_id=${c.jobId}::uuid and (not exists(select 1 from ${queue} q where q.series_id=i.series_id) ${kind === "cast" ? sql`or not exists(select 1 from tv_series t where t.id=i.series_id and not t.is_deleted)` : sql``})`);
  const rows = await db.execute(sql`with hot as (
    select i.series_id,i.requested_at from tv_job_campaign_items i left join tv_popularity_scores p on p.series_id=i.series_id
    where i.job_id=${c.jobId}::uuid and not i.failed order by p.score desc nulls last,i.requested_at,i.series_id limit ${Math.ceil(limit / 2)}
  ), older as (
    select i.series_id,i.requested_at from tv_job_campaign_items i where i.job_id=${c.jobId}::uuid and not i.failed and i.series_id not in(select series_id from hot)
    order by i.requested_at,i.series_id limit ${Math.floor(limit / 2)}
  ) select x.series_id,x.requested_at::text,t.source_url from(select * from hot union all select * from older)x left join tv_series t on t.id=x.series_id`);
  return rows.map(row => ({ seriesId: Number(row.series_id), requestedAt: String(row.requested_at), sourceUrl: String(row.source_url ?? "") }));
}
export async function tvCampaignHasMore(db: DbProvider["client"]) {
  const c = currentTvCampaign(); if (!c) return null;
  const [row] = await db.execute(sql`select exists(select 1 from tv_job_campaign_items where job_id=${c.jobId}::uuid and not failed) pending`);
  return Boolean(row.pending);
}
