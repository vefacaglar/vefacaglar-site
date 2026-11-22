/** Finite one-ID daily campaigns against disposable PostgreSQL and Meilisearch. */
import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql,eq } from "drizzle-orm";
import { schema,tvSeasons,tvEpisodes } from "@vefacaglar/db";
import { DbProvider } from "../db.provider";
import { TvCampaignRepository } from "../modules/tv-series/daily/tv-campaign.repository";
import { TvDailyJobService } from "../modules/tv-series/daily/tv-daily-job.service";
import { SyncTvSeriesHandler } from "../modules/tv-series/import/sync.handler";
import { DrizzleTvSourceRepository } from "../modules/tv-series/import/tv-source.repository";
import { parseTvShow, parseTvHierarchy } from "../modules/tv-series/import/tvmaze-normalizer";
import { TvmazeClient, TvmazeError } from "../modules/tv-series/import/tvmaze.client";
import { RefreshTvCastHandler } from "../modules/tv-series/cast/refresh.handler";
import { DrizzleTvCastRepository } from "../modules/tv-series/cast/tv-cast.repository";
import { TvPersonIdentityClient } from "../modules/tv-series/cast/tv-person-identity.client";
import { SyncTvIndexHandler } from "../modules/tv-series/search-sync/sync.handler";
import { DrizzleTvIndexRepository } from "../modules/tv-series/search-sync/tv-index.repository";
import { TvIndexClient } from "../modules/tv-series/search-sync/tv-index.client";
async function main() {
  const url=process.env.TV_TEST_DATABASE_URL,meili=process.env.TV_TEST_MEILISEARCH_URL,key=process.env.TV_TEST_MEILISEARCH_API_KEY;
  if(!url||!["127.0.0.1","localhost"].includes(new URL(url).hostname)||!/test|verify|integration/.test(new URL(url).pathname)||!meili||!key||!["127.0.0.1","localhost"].includes(new URL(meili).hostname))throw new Error("Use disposable loopback TV_TEST_DATABASE_URL and TV_TEST_MEILISEARCH_URL/API_KEY");
  process.env.MEILISEARCH_URL=meili;process.env.MEILISEARCH_API_KEY=key;
  const client=postgres(url,{max:5}),db=drizzle(client,{schema}),provider=new DbProvider(db);
  try {
    assert.equal((await db.execute(sql`select count(*)::int n from tv_job_campaigns`))[0].n,0,"Use a fresh migrated daily-test DB");
    // Other integration fixtures can exist, but do not enter these closed cohorts.
    await db.execute(sql`delete from tv_refresh_queue;delete from tv_cast_queue;update tv_source_state set next_page=0,index_complete=false,index_started_at=clock_timestamp(),updates_checked_at=null,cooldown_until=null where id='tvmaze'`);
    const source=new DrizzleTvSourceRepository(provider),castRepo=new DrizzleTvCastRepository(provider),campaigns=new TvCampaignRepository(provider);
    const show=(id:number)=>parseTvShow({id,name:`Daily fixture ${id}`,genres:[],url:`https://www.tvmaze.com/shows/${id}/fixture`,updated:1700000000});
    const hierarchy=(id:number)=>parseTvHierarchy(show(id),[],[]);
    let updates=0,pages=0,hydrated=0,failCatalog=true,lateCatalog=false,lateCatalogId=0,castCalls=0,failCast=true,lateCast=false,invalidCastOnce=false,loseOwnerOnCast=false;
    const mockClient={
      updates:async()=>{updates++;return Array.from({length:126},(_,i)=>({id:i+1,updatedAt:new Date()})).concat([{id:10251,updatedAt:new Date()}]);},
      page:async(page:number)=>{pages++;assert.ok(page<=41);return[show(page*250+1)];},
      hierarchy:async(id:number)=>{
        if(failCatalog&&hydrated===70){failCatalog=false;throw new TvmazeError("tvmaze_http_503",503,new Date(0));}
        hydrated++;
        if(!lateCatalog){lateCatalog=true;lateCatalogId=id;await source.updates([{id:2000000,updatedAt:new Date()},{id,updatedAt:new Date()}],new Date(0));}
        return {show:show(id),seasons:await db.select().from(tvSeasons).where(eq(tvSeasons.seriesId,id)),episodes:await db.select().from(tvEpisodes).where(eq(tvEpisodes.seriesId,id))};
      },
      cast:async(id:number)=>{
        if(invalidCastOnce){invalidCastOnce=false;throw new Error("fixture_cast_invalid");}
        if(loseOwnerOnCast){loseOwnerOnCast=false;await db.execute(sql`update jobs set locked_by='replacement-owner' where id=${process.env.VEFA_JOB_ID!}::uuid`);}
        if(failCast&&castCalls===330){failCast=false;throw new TvmazeError("tvmaze_http_503",503,new Date(0));}
        castCalls++;
        if(!lateCast){lateCast=true;await db.execute(sql`insert into tv_series(id,name,source_url)values(4000000,'Later cast title','https://www.tvmaze.com/shows/4000000/later')on conflict do nothing`);await db.execute(sql`insert into tv_cast_queue(series_id)values(4000000)`);await db.execute(sql`update tv_cast_queue set requested_at=requested_at+interval '1 microsecond' where series_id=${id}`);}
        return[];
      },
    } as unknown as TvmazeClient;
    const identities={identities:async()=>Array.from({length:1002},(_,i)=>({externalId:i+1,qid:`Q${i+1}`})),castBirthdates:async()=>[]} as unknown as TvPersonIdentityClient;
    const catalog=new SyncTvSeriesHandler(mockClient,source),cast=new RefreshTvCastHandler(mockClient,identities,castRepo),indexRepo=new DrizzleTvIndexRepository(provider),indexClient=new TvIndexClient();
    const search=new SyncTvIndexHandler(indexClient,indexRepo),service=new TvDailyJobService(campaigns,catalog,cast,search);
    const createJob=async(type:string)=>{const id=randomUUID(),owner=`daily-${id}`;await db.execute(sql`insert into jobs(id,type,status,locked_by,heartbeat_at,attempts)values(${id}::uuid,${type},'running',${owner},now(),1)`);process.env.VEFA_JOB_ID=id;process.env.VEFA_JOB_WORKER_ID=owner;return{id,owner};};
    const resume=async(job:{id:string;owner:string})=>{job.owner+='-resumed';await db.execute(sql`update jobs set locked_by=${job.owner},heartbeat_at=now()where id=${job.id}::uuid`);process.env.VEFA_JOB_ID=job.id;process.env.VEFA_JOB_WORKER_ID=job.owner;};
    const catalogJob=await createJob("catalog.tv-series.sync"),messages:string[]=[];
    await assert.rejects(()=>service.run("catalog.tv-series.sync",message=>messages.push(message)),/tvmaze_http_503/);
    assert.equal(pages,42);assert.equal(updates,1);assert.equal(hydrated,70);
    await resume(catalogJob);
    const catalogResult=await service.run("catalog.tv-series.sync",message=>messages.push(message));
    assert.ok(catalogResult.processed>160);assert.equal(updates,1,"retry must not rediscover updates");assert.equal(pages,42,"retry must not restart source discovery");
    assert.ok((await db.execute(sql`select series_id from tv_refresh_queue where series_id=2000000`)).length);
    assert.ok((await db.execute(sql`select series_id from tv_refresh_queue where series_id=${lateCatalogId}`)).length,"newer request survives old cohort ACK");
    const catalogRow=(await db.execute(sql`select stage from tv_job_campaigns where job_id=${catalogJob.id}::uuid`))[0];assert.equal(catalogRow.stage,"complete");
    const castJob=await createJob("catalog.tv-series.cast.refresh");
    await assert.rejects(()=>service.run("catalog.tv-series.cast.refresh",message=>messages.push(message)),/tvmaze_http_503/);
    await resume(castJob);
    const castResult=await service.run("catalog.tv-series.cast.refresh",message=>messages.push(message));
    assert.ok(castResult.processed>160);assert.equal((await db.execute(sql`select cast_complete from tv_series where id=4000000`))[0].cast_complete,false,"new title is deferred beyond closed cast cohort");
    assert.ok((await db.execute(sql`select series_id from tv_cast_queue where series_id=4000000`)).length);
    assert.ok(messages.length<500,"progress must stay aggregated");
    // Cross former 40x1000 index cap and change dirty state continuously while
    // replaying the fixed captured revisions. Later changes stay pending.
    await db.execute(sql`insert into tv_series(id,name,source_url)select n,'Index daily '||n,'https://www.tvmaze.com/shows/'||n||'/fixture'from generate_series(10000000,10041004)n`);
    await db.execute(sql`insert into tv_search_dirty(series_id)select id from tv_series on conflict(series_id)do update set revision=tv_search_dirty.revision+1`);
    const searchJob=await createJob("search.tv-series.sync");
    let imports=0,failIndex=true;
    const original=indexClient.documents.bind(indexClient);
    let lateIndex=false,earlySearchArrival=false;
    indexClient.documents=async(index,rows)=>{
      if(failIndex&&++imports===3){failIndex=false;throw new Error("fixture_index_transient");}
      if(!earlySearchArrival){earlySearchArrival=true;await db.execute(sql`insert into tv_series(id,name,source_url)values(9000000,'New during scan','https://www.tvmaze.com/shows/9000000/later')`);await db.execute(sql`insert into tv_search_dirty(series_id)values(9000000)`);}
      if((await indexRepo.state()).phase==="dirty"&&rows.length){
        const id=(rows[0]as{id:number}).id;
        await db.execute(sql`update tv_series set name=name||' changed' where id=${id}`);
        await db.execute(sql`insert into tv_search_dirty(series_id)values(${id})on conflict(series_id)do update set revision=tv_search_dirty.revision+1`);
        if(!lateIndex){lateIndex=true;await db.execute(sql`insert into tv_series(id,name,source_url)values(20000000,'Later search title','https://www.tvmaze.com/shows/20000000/later')`);await db.execute(sql`insert into tv_search_dirty(series_id)values(20000000)`);}
      }
      return original(index,rows);
    };
    await assert.rejects(()=>service.run("search.tv-series.sync"),/fixture_index_transient/);
    const before=await indexRepo.state();assert.ok(before.scanCursor!==null);
    await resume(searchJob);
    let laterSearch=false;
    await service.run("search.tv-series.sync",message=>{messages.push(message);if(message.startsWith("Index changed rows="))laterSearch=true;});
    assert.ok(laterSearch);const after=await indexRepo.state();assert.equal(after.phase,"ready");assert.equal(after.buildIndex,null);
    assert.equal(after.rankingReady,false,"newer pending canonical writes must not be labeled current");
    assert.ok((await db.execute(sql`select series_id from tv_search_dirty where series_id=20000000`)).length);
    assert.ok((await db.execute(sql`select series_id from tv_search_dirty where series_id=9000000`)).length,"newly arriving records during scan stay outside its initial member snapshot");
    assert.equal((await db.execute(sql`select count(*)::int n from jobs where id in(${catalogJob.id}::uuid,${castJob.id}::uuid,${searchJob.id}::uuid)`))[0].n,3);
    const stats=await fetch(meili.replace(/\/$/,"")+"/indexes/tv_series_en/stats",{headers:{Authorization:`Bearer ${key}`}}).then(response=>response.json())as any;
    assert.ok(stats.numberOfDocuments>41000);
    // A changed worker owner cannot mutate or complete the previous campaign.
    process.env.VEFA_JOB_ID=searchJob.id;process.env.VEFA_JOB_WORKER_ID="old-owner";
    await assert.rejects(()=>service.run("search.tv-series.sync"),/tv_job_lease_or_cancellation_changed/);
    // Failed source members remain repairable under the same ID, without
    // reopening the successful cohort or rediscovering new work.
    const failedJob=await createJob("catalog.tv-series.cast.refresh");invalidCastOnce=true;
    await assert.rejects(()=>service.run("catalog.tv-series.cast.refresh"),/tv_daily_cohort_contains_failed_items/);
    assert.equal((await db.execute(sql`select stage from tv_job_campaigns where job_id=${failedJob.id}::uuid`))[0].stage,"failed");
    assert.ok((await db.execute(sql`select series_id from tv_job_campaign_items where job_id=${failedJob.id}::uuid and failed`)).length);
    await resume(failedJob);await service.run("catalog.tv-series.cast.refresh");
    assert.equal((await db.execute(sql`select stage from tv_job_campaigns where job_id=${failedJob.id}::uuid`))[0].stage,"complete");
    await db.execute(sql`insert into tv_series(id,name,source_url)values(5000000,'Lease fixture','https://www.tvmaze.com/shows/5000000/lease')`);
    await db.execute(sql`insert into tv_cast_queue(series_id)values(5000000)`);
    const fenced=await createJob("catalog.tv-series.cast.refresh");loseOwnerOnCast=true;
    await assert.rejects(()=>service.run("catalog.tv-series.cast.refresh"),/tv_job_lease_or_cancellation_changed/);
    assert.equal((await db.execute(sql`select cast_complete from tv_series where id=5000000`))[0].cast_complete,false,"lost worker must roll back canonical cast writes");
    assert.equal((await db.execute(sql`select processed from tv_job_campaigns where job_id=${fenced.id}::uuid`))[0].processed,0);
    console.log(JSON.stringify({catalogPages:pages,catalogProcessed:catalogResult.processed,castProcessed:castResult.processed,indexDocuments:stats.numberOfDocuments,sameJobRestart:true,finiteNewWork:true,leaseFence:true,failedMemberRepair:true,progressLines:messages.length}));
  }finally{await client.end({timeout:3});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
