import { injectable } from "tsyringe";
import { TvCampaignRepository } from "./tv-campaign.repository";
import { tvCampaignStorage } from "./tv-campaign";
import { SyncTvSeriesHandler } from "../import/sync.handler";
import { RefreshTvCastHandler } from "../cast/refresh.handler";
import { SyncTvIndexHandler } from "../search-sync/sync.handler";
@injectable()
export class TvDailyJobService {
  constructor(private readonly campaigns:TvCampaignRepository,private readonly catalog:SyncTvSeriesHandler,private readonly cast:RefreshTvCastHandler,private readonly search:SyncTvIndexHandler){}
  private async report(progress:(message:string)=>void){
    const status=await this.campaigns.status();progress(`Daily cohort stage=${status.stage} processed=${status.processed} remaining=${status.remaining} failed=${status.failed} horizon=${status.horizon}`);
  }
  async runSnapshot<T>(type:string,operation:()=>Promise<T>) {
    const jobId=process.env.VEFA_JOB_ID,workerId=process.env.VEFA_JOB_WORKER_ID;
    if(!jobId||!workerId)throw new Error("tv_worker_job_identity_required");
    const campaign=await this.campaigns.open(type,jobId,workerId);
    return tvCampaignStorage.run(campaign,async()=>{
      if(campaign.stage==="complete")return{resumedComplete:true};
      await this.campaigns.assertLease();const result=await operation();await this.campaigns.finish();return result;
    });
  }
  async run(type:string,progress:(message:string)=>void=()=>{}) {
    const jobId=process.env.VEFA_JOB_ID,workerId=process.env.VEFA_JOB_WORKER_ID;
    if(!jobId||!workerId||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(jobId))throw new Error("tv_worker_job_identity_required");
    const campaign=await this.campaigns.open(type,jobId,workerId);
    return tvCampaignStorage.run(campaign,async()=>{
      if(campaign.stage==="failed")await this.campaigns.retryFailed();
      if(campaign.stage==="complete")return{processed:0,failed:0,resumedComplete:true};
      await this.campaigns.assertLease();
      if(campaign.stage==="init"){
        if(type==="catalog.tv-series.sync"){
          const prepared=await this.catalog.prepareDaily(progress);
          await this.campaigns.stage(prepared.discovery?"discover":"capture",prepared.ceiling);
        }else if(type==="catalog.tv-series.cast.refresh"){
          await this.cast.prepareDaily();await this.campaigns.stage("capture");
        }else if(type==="search.tv-series.sync")await this.campaigns.startSearch();
        else throw new Error("tv_daily_job_type_invalid");
      }
      await this.report(progress);
      for(;;){
        await this.campaigns.assertLease();
        if(campaign.stage==="capture")await this.campaigns.capture(type==="catalog.tv-series.sync"?"catalog":"cast");
        if(type==="search.tv-series.sync"){
          const result=await this.search.handle(progress);
          await this.report(progress);
          if(result.published||!result.hasMore)return this.campaigns.finish();
          if(!result.progressMade)throw new Error("tv_daily_search_made_no_progress");
        }else if(type==="catalog.tv-series.sync"){
          const result=await this.catalog.handle(progress);
          progress(`Catalog chunk pages=${result.pages} shows=${result.shows} hydrated=${result.hydrated} failed=${result.failed}`);
          if(campaign.stage==="discover"&&result.discoveryComplete){await this.campaigns.stage("capture");continue;}
          await this.report(progress);
          if(campaign.stage!=="discover"&&!result.hasMore)return this.campaigns.finish();
          if(!result.progressMade)throw new Error("tv_daily_catalog_made_no_progress");
        }else{
          const result=await this.cast.handle(progress);
          progress(`Cast chunk completed shows=${result.shows} roles=${result.roles} failed=${result.failed}`);
          await this.report(progress);
          if(!result.hasMore)return this.campaigns.finish();
          if(!result.progressMade)throw new Error("tv_daily_cast_made_no_progress");
        }
      }
    });
  }
}
