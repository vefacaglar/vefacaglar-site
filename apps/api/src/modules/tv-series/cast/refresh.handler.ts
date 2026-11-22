import { inject, injectable } from "tsyringe";
import { TvmazeClient, TvmazeError } from "../import/tvmaze.client";
import { TV_CAST_REPOSITORY, type ITvCastRepository, type TvCastItem, type TvCastRole, type PersonProof } from "./tv-cast.types";
import { parseTvPersonIdentities, matchCastBirthdates } from "./tv-cast-normalizer";
import { TvPersonIdentityClient } from "./tv-person-identity.client";
@injectable()
export class RefreshTvCastHandler {
  constructor(private readonly client:TvmazeClient,private readonly identities:TvPersonIdentityClient,@inject(TV_CAST_REPOSITORY)private readonly repository:ITvCastRepository){}
  async handle(progress:(message:string)=>void=()=>{}) {
    const deadline=Date.now()+150000,now=new Date(),state=await this.repository.state();let identities;
    if(state.identitiesCheckedAt&&state.identitiesCheckedAt.getTime()>now.getTime()-7*86400_000)identities=parseTvPersonIdentities(state.identityMap);
    else {progress("Fetching exact Wikidata TVmaze person identities");identities=await this.identities.identities(deadline);await this.repository.identities(identities,now);}
    const direct=new Map(identities.map(row=>[row.externalId,row.qid]));
    progress(`Verified direct person identities=${direct.size}`);
    await this.repository.prepare(now);
    let shows=0,roles=0,people=0,matched=0,merged=0,failed=0,comparisonAvailable=true;
    while(Date.now()+20000<deadline&&shows+failed<160) {
      const candidates=await this.repository.candidates(10,new Date());if(!candidates.length)break;
      const batch:{item:TvCastItem;rows:TvCastRole[]}[]=[];
      for(const item of candidates) {
        if(Date.now()+20000>=deadline)break;
        try {
          let rows=await this.client.cast(item.seriesId,deadline);
          // Confirm an empty main-cast response before replacing known roles.
          if(!rows.length)rows=await this.client.cast(item.seriesId,deadline);
          batch.push({item,rows});
        }catch(error){
          if(error instanceof TvmazeError&&(error.code==="tvmaze_budget_exhausted"))break;
          if(error instanceof TvmazeError&&(error.status===429||(error.status??0)>=500||error.code==="tvmaze_cooldown_active"||error.code==="tvmaze_request_failed"))throw error;
          await this.repository.failure(item,error instanceof Error&&/^[a-z0-9_]+$/.test(error.message)?error.message:"tv_cast_snapshot_invalid",new Date(Date.now()+86400_000));failed++;
        }
      }
      if(!batch.length)break;
      const proofs=new Map<number,PersonProof>();
      for(const {rows}of batch)for(const {person}of rows){const qid=direct.get(person.externalId);if(qid)proofs.set(person.externalId,{qid,method:"tvmaze_person_id"});}
      const pending=[...new Set(batch.flatMap(({rows})=>rows.filter(row=>!proofs.has(row.person.externalId)&&row.person.name&&row.person.birthDate).map(row=>row.person.externalId)))];
      const checkIds=new Set(await this.repository.identityCandidates(pending,new Date(now.getTime()-7*86400_000)));
      let checkedAt=state.identitiesCheckedAt??now;
      if(comparisonAvailable&&checkIds.size&&Date.now()+15000<deadline)try {
        const selected=batch.map(({item,rows})=>({seriesId:item.seriesId,rows:rows.filter(row=>checkIds.has(row.person.externalId))})).filter(show=>show.rows.length);
        const raw=await this.identities.castBirthdates(selected.map(show=>show.seriesId),deadline);
        const filmQids=new Set(await this.repository.existingFilmQids([...new Set(raw.map(row=>row.qid))]));
        for(const [id,proof]of matchCastBirthdates(selected,raw,filmQids,identities))proofs.set(id,proof);
        checkedAt=new Date();
      }catch{comparisonAvailable=false;progress("Qualified cast and birthdate comparison unavailable; retaining exact IDs and previously verified links");}
      for(const {item,rows}of batch)try {
        const result=await this.repository.publish(item,rows,proofs,checkedAt,new Date());shows++;roles+=rows.length;people+=result.people;matched+=result.matched;merged+=result.merged;
        progress(`Cast series=${item.seriesId} roles=${rows.length} linkedPeople=${result.matched} mergedAliases=${result.merged}`);
      }catch(error){await this.repository.failure(item,error instanceof Error&&/^[a-z0-9_]+$/.test(error.message)?error.message:"tv_cast_snapshot_write_failed",new Date(Date.now()+86400_000));failed++;}
    }
    const hasMore=await this.repository.hasMore(new Date());
    return{shows,roles,people,matched,merged,failed,hasMore,progressMade:shows+failed>0,nextRunAt:hasMore?new Date(Date.now()+30000).toISOString():null};
  }
}
