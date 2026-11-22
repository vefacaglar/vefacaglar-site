import "reflect-metadata";
import { afterEach,describe,it,expect,vi } from "vitest";
import { TvDailyJobService } from "./tv-daily-job.service";
import type { TvCampaignRepository } from "./tv-campaign.repository";
import type { SyncTvSeriesHandler } from "../import/sync.handler";
import type { RefreshTvCastHandler } from "../cast/refresh.handler";
import type { SyncTvIndexHandler } from "../search-sync/sync.handler";
const id="00000000-0000-4000-8000-000000000001";
function setup(type:string){
  vi.stubEnv("VEFA_JOB_ID",id);vi.stubEnv("VEFA_JOB_WORKER_ID","worker");
  const state={jobId:id,workerId:"worker",type,stage:"init",horizon:"2026-11-22 00:00:00.123456+00",ceiling:null};
  const campaigns={status:vi.fn().mockResolvedValue({stage:"work",processed:0,remaining:10,failed:0,horizon:"2026-11-22"}),open:vi.fn().mockResolvedValue(state),stage:vi.fn().mockImplementation(async stage=>{state.stage=stage;}),capture:vi.fn().mockImplementation(async()=>{state.stage="work";}),startSearch:vi.fn().mockImplementation(async()=>{state.stage="scan";}),maxSeriesId:vi.fn().mockResolvedValue(999),assertLease:vi.fn(),retryFailed:vi.fn().mockImplementation(async()=>{state.stage="work";}),finish:vi.fn().mockImplementation(async()=>{state.stage="complete";return{processed:500,failed:0};})};
  const catalog={prepareDaily:vi.fn().mockResolvedValue({discovery:true,ceiling:999}),handle:vi.fn()};
  const cast={prepareDaily:vi.fn(),handle:vi.fn()};const search={handle:vi.fn()};
  const service=new TvDailyJobService(campaigns as unknown as TvCampaignRepository,catalog as unknown as SyncTvSeriesHandler,cast as unknown as RefreshTvCastHandler,search as unknown as SyncTvIndexHandler);
  return{state,campaigns,catalog,cast,search,service};
}
afterEach(()=>vi.unstubAllEnvs());
describe("TvDailyJobService",()=>{
  it("publishes a complete daily snapshot once across retries",async()=>{
    const{service}=setup("catalog.tv-series.popularity.refresh");const operation=vi.fn().mockResolvedValue({generation:1});
    expect(await service.runSnapshot("catalog.tv-series.popularity.refresh",operation)).toEqual({generation:1});
    expect(await service.runSnapshot("catalog.tv-series.popularity.refresh",operation)).toEqual({resumedComplete:true});expect(operation).toHaveBeenCalledOnce();
  });
  it("finishes discovery once then every hierarchy chunk under one job",async()=>{
    const{service,catalog,campaigns}=setup("catalog.tv-series.sync");
    catalog.handle.mockResolvedValueOnce({pages:40,shows:10000,hydrated:0,failed:0,discoveryComplete:false,hasMore:true,progressMade:true})
      .mockResolvedValueOnce({pages:2,shows:500,hydrated:0,failed:0,discoveryComplete:true,hasMore:true,progressMade:true})
      .mockResolvedValueOnce({pages:0,shows:0,hydrated:60,failed:0,discoveryComplete:true,hasMore:true,progressMade:true})
      .mockResolvedValueOnce({pages:0,shows:0,hydrated:30,failed:0,discoveryComplete:true,hasMore:false,progressMade:true});
    await service.run("catalog.tv-series.sync");
    expect(catalog.prepareDaily).toHaveBeenCalledOnce();expect(catalog.handle).toHaveBeenCalledTimes(4);expect(campaigns.capture).toHaveBeenCalledOnce();expect(campaigns.finish).toHaveBeenCalledOnce();
  });
  it("resumes the closed cohort without a second discovery or preparation",async()=>{
    const{service,cast,state}=setup("catalog.tv-series.cast.refresh");
    cast.handle.mockRejectedValueOnce(new Error("provider failed"));
    await expect(service.run("catalog.tv-series.cast.refresh")).rejects.toThrow("provider failed");
    expect(state.stage).toBe("work");
    cast.handle.mockResolvedValue({shows:200,roles:500,failed:0,hasMore:false,progressMade:true});
    await service.run("catalog.tv-series.cast.refresh");expect(cast.prepareDaily).toHaveBeenCalledOnce();
  });
  it("allows a failed closed member set to be repaired under the same ID",async()=>{
    const{service,cast,state,campaigns}=setup("catalog.tv-series.cast.refresh");state.stage="failed";
    cast.handle.mockResolvedValue({shows:1,roles:1,failed:0,hasMore:false,progressMade:true});await service.run("catalog.tv-series.cast.refresh");
    expect(campaigns.retryFailed).toHaveBeenCalledOnce();expect(cast.prepareDaily).not.toHaveBeenCalled();expect(campaigns.capture).not.toHaveBeenCalled();
  });
  it("publishes once and exits even if newer work is pending for tomorrow",async()=>{
    const{service,search,campaigns}=setup("search.tv-series.sync");
    search.handle.mockResolvedValueOnce({published:false,hasMore:true,progressMade:true}).mockResolvedValueOnce({published:true,hasMore:true,progressMade:true});
    await service.run("search.tv-series.sync");expect(search.handle).toHaveBeenCalledTimes(2);expect(campaigns.finish).toHaveBeenCalledOnce();
  });
  it("fails explicitly instead of spinning without progress",async()=>{
    const{service,cast}=setup("catalog.tv-series.cast.refresh");cast.handle.mockResolvedValue({hasMore:true,progressMade:false});
    await expect(service.run("catalog.tv-series.cast.refresh")).rejects.toThrow("tv_daily_cast_made_no_progress");expect(cast.handle).toHaveBeenCalledOnce();
  });
  it("stops before another chunk when job ownership/cancellation changes",async()=>{
    const{service,cast,campaigns}=setup("catalog.tv-series.cast.refresh");cast.handle.mockResolvedValue({shows:160,roles:1000,failed:0,hasMore:true,progressMade:true});
    campaigns.assertLease.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("lost lease"));
    await expect(service.run("catalog.tv-series.cast.refresh")).rejects.toThrow("lost lease");expect(cast.handle).toHaveBeenCalledOnce();
  });
});
