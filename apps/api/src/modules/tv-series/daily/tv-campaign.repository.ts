import { injectable } from "tsyringe";
import { sql } from "drizzle-orm";
import { DbProvider } from "../../../db.provider";
import { currentTvCampaign, guardTvCampaign, type TvCampaign } from "./tv-campaign";
@injectable()
export class TvCampaignRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async open(type: string, jobId: string, workerId: string): Promise<TvCampaign> {
    await this.dbProvider.client.execute(sql`insert into tv_job_campaigns(job_id,type) select id,type from jobs where id=${jobId}::uuid and type=${type} and status='running' and locked_by=${workerId} and not cancel_requested on conflict do nothing`);
    const [row] = await this.dbProvider.client.execute(sql`select c.job_id,c.type,c.stage,c.horizon::text,c.ceiling from tv_job_campaigns c join jobs j on j.id=c.job_id where c.job_id=${jobId}::uuid and j.type=${type} and j.status='running' and j.locked_by=${workerId} and not j.cancel_requested`);
    if (!row) throw new Error("tv_job_lease_or_cancellation_changed");
    return { jobId, workerId, type, stage: String(row.stage), horizon: String(row.horizon), ceiling: row.ceiling == null ? null : Number(row.ceiling) };
  }
  async stage(stage: string, ceiling?: number | null) {
    const c = currentTvCampaign()!;
    await this.dbProvider.transaction(async () => {
      await guardTvCampaign(this.dbProvider.client, true);
      await this.dbProvider.client.execute(sql`update tv_job_campaigns set stage=${stage},ceiling=${ceiling === undefined ? c.ceiling : ceiling} where job_id=${c.jobId}::uuid`);
    });
    c.stage = stage; if (ceiling !== undefined) c.ceiling = ceiling;
  }
  async status(){
    const c=currentTvCampaign()!;
    const[row]=await this.dbProvider.client.execute(sql`select stage,processed,failed,horizon::text,(select count(*)::int from tv_job_campaign_items where job_id=${c.jobId}::uuid)remaining from tv_job_campaigns where job_id=${c.jobId}::uuid`);
    return{stage:String(row.stage),processed:Number(row.processed),failed:Number(row.failed),remaining:Number(row.remaining),horizon:String(row.horizon)};
  }
  async assertLease(){await guardTvCampaign(this.dbProvider.client);}
  async startSearch(){
    const c=currentTvCampaign()!;
    await this.dbProvider.transaction(async()=>{
      const db=this.dbProvider.client;await guardTvCampaign(db,true);
      await db.execute(sql`insert into tv_job_campaign_items(job_id,series_id) select ${c.jobId}::uuid,id from tv_series on conflict do nothing`);
      const[row]=await db.execute(sql`select coalesce(max(series_id),0)::int ceiling from tv_job_campaign_items where job_id=${c.jobId}::uuid`);
      c.ceiling=Number(row.ceiling);await db.execute(sql`update tv_job_campaigns set stage='scan',ceiling=${c.ceiling} where job_id=${c.jobId}::uuid`);
    });c.stage="scan";
  }
  async maxSeriesId() { const [row] = await this.dbProvider.client.execute(sql`select coalesce(max(id),0)::int ceiling from tv_series`); return Number(row.ceiling); }
  async capture(kind: "catalog" | "cast" | "search") {
    const c = currentTvCampaign()!;
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      await guardTvCampaign(db, true);
      if (kind === "search") {
        await db.execute(sql`update tv_job_campaign_items i set revision=d.revision from tv_search_dirty d where i.job_id=${c.jobId}::uuid and i.series_id=d.series_id`);
        await db.execute(sql`delete from tv_job_campaign_items where job_id=${c.jobId}::uuid and revision is null`);
      } else {
        const queue = kind === "cast" ? sql`tv_cast_queue` : sql`tv_refresh_queue`;
        await db.execute(sql`update tv_job_campaigns set horizon=clock_timestamp() where job_id=${c.jobId}::uuid`);
        await db.execute(sql`insert into tv_job_campaign_items(job_id,series_id,requested_at) select c.job_id,q.series_id,q.requested_at from ${queue} q cross join tv_job_campaigns c where c.job_id=${c.jobId}::uuid and q.due_at<=c.horizon on conflict do nothing`);
      }
      await db.execute(sql`update tv_job_campaigns set stage='work' where job_id=${c.jobId}::uuid`);
    });
    c.stage = "work";
  }
  async retryFailed(){
    const c=currentTvCampaign()!;
    await this.dbProvider.transaction(async()=>{
      const db=this.dbProvider.client;await guardTvCampaign(db,true);
      await db.execute(sql`update tv_job_campaign_items set failed=false where job_id=${c.jobId}::uuid`);
      await db.execute(sql`update tv_job_campaigns set failed=0,stage='work' where job_id=${c.jobId}::uuid`);
    });c.stage="work";
  }
  async remaining() {
    const c = currentTvCampaign()!;
    const [row] = await this.dbProvider.client.execute(sql`select count(*)::int n from tv_job_campaign_items where job_id=${c.jobId}::uuid`); return Number(row.n);
  }
  async finish() {
    const c=currentTvCampaign()!;
    const result=await this.dbProvider.transaction(async()=>{
      const db=this.dbProvider.client;await guardTvCampaign(db,true);
      const[row]=await db.execute(sql`select processed,(select count(*)::int from tv_job_campaign_items where job_id=${c.jobId}::uuid and failed) failed from tv_job_campaigns where job_id=${c.jobId}::uuid`);
      c.stage=Number(row.failed)?"failed":"complete";
      await db.execute(sql`update tv_job_campaigns set stage=${c.stage},failed=${Number(row.failed)} where job_id=${c.jobId}::uuid`);
      if(!Number(row.failed))await db.execute(sql`delete from tv_job_campaign_items where job_id=${c.jobId}::uuid`);
      return{processed:Number(row.processed),failed:Number(row.failed)};
    });
    if(result.failed)throw new Error("tv_daily_cohort_contains_failed_items");return result;
  }
}
