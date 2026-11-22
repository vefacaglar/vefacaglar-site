import { guardTvCampaign, finishTvCampaignItem, tvCampaignCandidates, tvCampaignHasMore } from "../daily/tv-campaign";
import { injectable } from "tsyringe";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { tvCast, tvCastQueue, tvCastState, tvSeries, moviePeople, moviePersonSources, moviePersonAliases, movieCredits } from "@vefacaglar/db";
import { DbProvider } from "../../../db.provider";
import type { ITvCastRepository, TvCastItem, TvCastRole, TvPersonIdentity, PersonProof, TvCastPerson } from "./tv-cast.types";
@injectable()
export class DrizzleTvCastRepository implements ITvCastRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async state() {
    const [state] = await this.dbProvider.client.select().from(tvCastState).where(eq(tvCastState.id,"tvmaze"));
    if(!state) throw new Error("tv_cast_state_missing_migration"); return state;
  }
  async identities(rows: TvPersonIdentity[],at:Date) {
    await this.dbProvider.client.update(tvCastState).set({identityMap:rows,identitiesCheckedAt:at}).where(eq(tvCastState.id,"tvmaze"));
  }
  async prepare(now:Date) {
    await this.dbProvider.transaction(async()=>{
    await this.dbProvider.client.execute(sql`insert into ${tvCastQueue}(series_id,requested_at,due_at)
      select id,${now.toISOString()}::timestamptz,${now.toISOString()}::timestamptz from ${tvSeries} where not is_deleted and hierarchy_complete
      and (not cast_complete or cast_updated_at<${new Date(now.getTime()-7*86400_000).toISOString()}::timestamptz) on conflict(series_id) do nothing`);
    await this.dbProvider.client.execute(sql`delete from ${tvCastQueue} q using ${tvSeries} t where t.id=q.series_id and t.is_deleted`);
    await guardTvCampaign(this.dbProvider.client,true);
    });
  }
  async candidates(limit:number,now:Date):Promise<TvCastItem[]> {
    const db=this.dbProvider.client;
    const cohort=await this.dbProvider.transaction(()=>tvCampaignCandidates(this.dbProvider.client,"cast",limit));if(cohort)return cohort;
    const hot=await db.execute(sql`select q.series_id,q.requested_at::text as requested_at,t.source_url from ${tvCastQueue} q join ${tvSeries} t on t.id=q.series_id
      where q.due_at<=${now.toISOString()}::timestamptz and not t.is_deleted order by t.popularity_score desc nulls last,q.requested_at,q.series_id limit ${Math.ceil(limit/2)}`);
    const hotIds=hot.map(row=>Number(row.series_id));
    const older=await db.execute(sql`select q.series_id,q.requested_at::text as requested_at,t.source_url from ${tvCastQueue} q join ${tvSeries} t on t.id=q.series_id
      where q.due_at<=${now.toISOString()}::timestamptz and not t.is_deleted ${hotIds.length?sql`and q.series_id<>all(${`{${hotIds.join(",")}}`}::int[])`:sql``}
      order by q.requested_at,q.series_id limit ${limit-hot.length}`);
    return [...hot,...older].map(row=>({seriesId:Number(row.series_id),sourceUrl:String(row.source_url),requestedAt:String(row.requested_at)}));
  }
  async identityCandidates(ids:number[],before:Date) {
    if(!ids.length)return[];
    const known=await this.dbProvider.client.select({externalId:moviePersonSources.externalId}).from(moviePersonSources).where(and(eq(moviePersonSources.provider,"tvmaze"),inArray(moviePersonSources.externalId,ids.map(String)),sql`(${moviePersonSources.verifiedWikidataId} is not null or ${moviePersonSources.identityCheckedAt}>=${before.toISOString()}::timestamptz)`));
    const cached=new Set(known.map(row=>Number(row.externalId)));return ids.filter(id=>!cached.has(id));
  }
  async existingFilmQids(qids:string[]) {
    if(!qids.length)return[];
    const rows=await this.dbProvider.client.execute(sql`select distinct p.wikidata_id from ${moviePeople} p join ${movieCredits} c on c.person_id=p.id join movies m on m.id=c.movie_id
      where p.wikidata_id=any(${`{${qids.join(",")}}`}::text[]) and c.rank<>'deprecated' and m.is_film and m.hydrated_at is not null and m.title is not null`);
    return rows.map(row=>String(row.wikidata_id));
  }
  async publish(item:TvCastItem,rows:TvCastRole[],proofs:Map<number,PersonProof>,identityCheckedAt:Date,at:Date) {
    return this.dbProvider.transaction(async()=>{
      const db=this.dbProvider.client;
      // Serialize identity merges across cast processes. Movie QID upserts remain
      // safe through their existing unique constraint/on-conflict contract.
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('shared-person-provider-identities',0))`);
      const [show]=await db.select({id:tvSeries.id,isDeleted:tvSeries.isDeleted}).from(tvSeries).where(eq(tvSeries.id,item.seriesId)).for("update");
      if(!show||show.isDeleted)throw new Error("tv_cast_series_no_longer_public");
      const people=new Map<number,string>();let matched=0,merged=0;
      for(const row of rows) {
        if(people.has(row.person.externalId))continue;
        const resolved=await this.person(row.person,proofs.get(row.person.externalId),identityCheckedAt,at);
        people.set(row.person.externalId,resolved.id);matched+=Number(resolved.matched);merged+=Number(resolved.merged);
      }
      await db.delete(tvCast).where(eq(tvCast.seriesId,item.seriesId));
      for(let offset=0;offset<rows.length;offset+=250)await db.insert(tvCast).values(rows.slice(offset,offset+250).map(row=>({seriesId:item.seriesId,personId:people.get(row.person.externalId)!,characterId:row.characterId,characterName:row.characterName,characterSourceUrl:row.characterSourceUrl,castOrder:row.castOrder,self:row.self,voice:row.voice,sourceUrl:item.sourceUrl,fetchedAt:at})));
      await db.update(tvSeries).set({castComplete:true,castUpdatedAt:at}).where(eq(tvSeries.id,item.seriesId));
      await db.delete(tvCastQueue).where(and(eq(tvCastQueue.seriesId,item.seriesId),sql`${tvCastQueue.requestedAt}<=${item.requestedAt instanceof Date?item.requestedAt.toISOString():item.requestedAt}::timestamptz`));
      await finishTvCampaignItem(db,item.seriesId);
      return {people:people.size,matched,merged};
    });
  }
  private async person(source:TvCastPerson,proof:PersonProof|undefined,checkedAt:Date,at:Date) {
    const db=this.dbProvider.client,externalId=String(source.externalId);
    const [link]=await db.select().from(moviePersonSources).where(and(eq(moviePersonSources.provider,"tvmaze"),eq(moviePersonSources.externalId,externalId)));
    const [existing]=link?await db.select().from(moviePeople).where(eq(moviePeople.id,link.personId)):[];
    if(existing?.wikidataId&&proof&&existing.wikidataId!==proof.qid)throw new Error("tv_person_verified_identity_conflict");
    let canonical=existing,merged=false;
    if(proof) {
      if(!/^Q[1-9]\d{0,20}$/.test(proof.qid)||!["tvmaze_person_id","show_cast_birthdate"].includes(proof.method))throw new Error("tv_person_invalid_identity_proof");
      await db.insert(moviePeople).values({wikidataId:proof.qid,name:source.name}).onConflictDoNothing({target:moviePeople.wikidataId});
      [canonical]=await db.select().from(moviePeople).where(eq(moviePeople.wikidataId,proof.qid)).for("update");
      if(!canonical)throw new Error("tv_person_identity_owner_missing");
      const [collision]=await db.select({id:moviePersonSources.externalId}).from(moviePersonSources).where(and(eq(moviePersonSources.provider,"tvmaze"),eq(moviePersonSources.personId,canonical.id),sql`${moviePersonSources.externalId}<>${externalId}`));
      if(collision)throw new Error("tv_person_provider_identity_collision");
      if(existing&&existing.id!==canonical.id) {
        await this.merge(existing.id,canonical.id);merged=true;
      }
    }
    if(!canonical) [canonical]=await db.insert(moviePeople).values({name:source.name}).returning();
    if(!canonical)throw new Error("tv_person_insert_failed");
    // A source spelling never overwrites a film's known Wikidata label.
    if(!canonical.wikidataId||!canonical.name)await db.update(moviePeople).set({name:source.name??canonical.name}).where(eq(moviePeople.id,canonical.id));
    await db.insert(moviePersonSources).values({provider:"tvmaze",externalId,personId:canonical.id,sourceUrl:source.sourceUrl,sourceName:source.name,birthDate:source.birthDate,deathDate:source.deathDate,gender:source.gender,country:source.country,sourceUpdatedAt:source.sourceUpdatedAt,fetchedAt:at,verifiedWikidataId:proof?.qid??link?.verifiedWikidataId??null,identityMethod:proof?.method??link?.identityMethod??null,identityCheckedAt:proof?at:link?.verifiedWikidataId?link.identityCheckedAt:checkedAt})
      .onConflictDoUpdate({target:[moviePersonSources.provider,moviePersonSources.externalId],set:{personId:canonical.id,sourceUrl:source.sourceUrl,sourceName:source.name,birthDate:source.birthDate,deathDate:source.deathDate,gender:source.gender,country:source.country,sourceUpdatedAt:source.sourceUpdatedAt,fetchedAt:at,verifiedWikidataId:proof?.qid??link?.verifiedWikidataId??null,identityMethod:proof?.method??link?.identityMethod??null,identityCheckedAt:proof?at:link?.verifiedWikidataId?link.identityCheckedAt:checkedAt}});
    return {id:canonical.id,matched:!!canonical.wikidataId,merged};
  }
  private async merge(former:string,target:string) {
    const db=this.dbProvider.client;
    const conflicts=await db.execute(sql`select 1 from ${moviePersonSources} a join ${moviePersonSources} b on a.provider=b.provider where a.person_id=${former}::uuid and b.person_id=${target}::uuid and a.external_id<>b.external_id limit 1`);
    if(conflicts.length)throw new Error("tv_person_merge_provider_conflict");
    await db.update(movieCredits).set({personId:target}).where(eq(movieCredits.personId,former));
    await db.execute(sql`insert into ${tvCast}(series_id,person_id,character_id,character_name,character_source_url,cast_order,self,voice,source_url,fetched_at)
      select series_id,${target}::uuid,character_id,character_name,character_source_url,cast_order,self,voice,source_url,fetched_at from ${tvCast} where person_id=${former}::uuid on conflict do nothing`);
    await db.delete(tvCast).where(eq(tvCast.personId,former));
    await db.update(moviePersonSources).set({personId:target}).where(eq(moviePersonSources.personId,former));
    await db.update(moviePersonAliases).set({personId:target}).where(eq(moviePersonAliases.personId,former));
    await db.insert(moviePersonAliases).values({aliasId:former,personId:target}).onConflictDoUpdate({target:moviePersonAliases.aliasId,set:{personId:target}});
  }
  async failure(item:TvCastItem,code:string,retryAt:Date) {
    await this.dbProvider.transaction(async()=>{
    await this.dbProvider.client.update(tvCastQueue).set({failureCount:sql`${tvCastQueue.failureCount}+1`,errorCode:code.slice(0,64),dueAt:retryAt}).where(eq(tvCastQueue.seriesId,item.seriesId));
    await finishTvCampaignItem(this.dbProvider.client,item.seriesId,true);
    });
  }
  async hasMore(now:Date) {
    const cohort=await tvCampaignHasMore(this.dbProvider.client);if(cohort!==null)return cohort;
    const [row]=await this.dbProvider.client.select({id:tvCastQueue.seriesId}).from(tvCastQueue).where(lte(tvCastQueue.dueAt,now)).limit(1);return!!row;
  }
}
