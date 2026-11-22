import "reflect-metadata";
import { describe,it,expect,vi } from "vitest";
import { RefreshTvCastHandler } from "./refresh.handler";
import { TvmazeClient,TvmazeError } from "../import/tvmaze.client";
import { TvPersonIdentityClient } from "./tv-person-identity.client";
import type { ITvCastRepository,TvCastRole } from "./tv-cast.types";
const role=(id=500000,birthDate:string|null="1980-01-02"):TvCastRole=>({person:{externalId:id,name:"Actor Example",birthDate,deathDate:null,gender:null,country:null,sourceUpdatedAt:null,sourceUrl:`https://www.tvmaze.com/people/${id}/actor`},characterId:id,characterName:"Character",characterSourceUrl:`https://www.tvmaze.com/characters/${id}/character`,castOrder:0,self:false,voice:null});
function setup(rows=[role()]) {
  const repository:Record<keyof ITvCastRepository,any>={state:vi.fn().mockResolvedValue({identityMap:Array.from({length:1002},(_,i)=>({externalId:i+1,qid:`Q${i+1}`})),identitiesCheckedAt:new Date()}),identities:vi.fn(),prepare:vi.fn(),candidates:vi.fn().mockResolvedValueOnce([{seriesId:1,sourceUrl:"https://www.tvmaze.com/shows/1/example",requestedAt:new Date()}]).mockResolvedValue([]),publish:vi.fn().mockResolvedValue({people:1,matched:1,merged:0}),identityCandidates:vi.fn().mockImplementation(async ids=>ids),existingFilmQids:vi.fn().mockResolvedValue(["Q99999"]),failure:vi.fn(),hasMore:vi.fn().mockResolvedValue(false)};
  const client={cast:vi.fn().mockResolvedValue(rows)};
  const identities={identities:vi.fn(),castBirthdates:vi.fn().mockResolvedValue([{seriesId:1,showQid:"Q9999",qid:"Q99999",name:"Actor Example",birthDate:"1980-01-02"}])};
  const handler=new RefreshTvCastHandler(client as unknown as TvmazeClient,identities as unknown as TvPersonIdentityClient,repository);
  return{repository,client,identities,handler};
}
describe("RefreshTvCastHandler",()=>{
  it("reuses an existing film actor only after unique exact show/name/full-birthdate evidence and retains multiple roles",async()=>{
    const a=role(),b={...a,characterId:12345,voice:true};const{handler,repository}=setup([a,b]);await handler.handle();
    const args=repository.publish.mock.calls[0];expect(args[1]).toHaveLength(2);expect(args[2].get(500000)).toEqual({qid:"Q99999",method:"show_cast_birthdate"});
  });
  it.each(["wrong birthday","missing birthday","wrong name","ambiguous qid","conflicting birthdays","no film credit","conflicting show","conflicting direct identity"])("leaves an unproved actor nullable: %s",async(reason)=>{
    const{handler,repository,identities}=setup([role(500000,reason==="missing birthday"?null:"1980-01-02")]);
    const candidate={seriesId:1,showQid:"Q9999",qid:"Q99999",name:"Actor Example",birthDate:"1980-01-02"};
    if(reason==="wrong birthday")candidate.birthDate="1980-01-03";
    if(reason==="wrong name")candidate.name="Other Actor";
    let candidates=[candidate];
    if(reason==="ambiguous qid"){candidates.push({...candidate,qid:"Q88888"});repository.existingFilmQids.mockResolvedValue(["Q99999","Q88888"]);}
    if(reason==="conflicting birthdays")candidates.push({...candidate,birthDate:"1980-01-03"});
    if(reason==="conflicting show")candidates.push({...candidate,showQid:"Q8888"});
    if(reason==="no film credit")repository.existingFilmQids.mockResolvedValue([]);
    if(reason==="conflicting direct identity")repository.state.mockResolvedValue({identityMap:[...Array.from({length:1002},(_,i)=>({externalId:i+1,qid:`Q${i+1}`})),{externalId:123456,qid:"Q99999"}],identitiesCheckedAt:new Date()});
    identities.castBirthdates.mockResolvedValue(candidates);await handler.handle();expect(repository.publish.mock.calls[0][2].has(500000)).toBe(false);
  });
  it("rejects an ambiguous two-person match independently of source order",async()=>{
    for(const rows of [[role(),role(500001)],[role(500001),role()]]){const{handler,repository}=setup(rows);await handler.handle();expect(repository.publish.mock.calls[0][2].size).toBe(0);}
  });
  it("confirms an empty response and retains a recovered full snapshot",async()=>{
    const{handler,client,repository}=setup();client.cast.mockResolvedValueOnce([]).mockResolvedValueOnce([role()]);await handler.handle();expect(client.cast).toHaveBeenCalledTimes(2);expect(repository.publish.mock.calls[0][1]).toHaveLength(1);
  });
  it("preserves the previous snapshot on provider backoff",async()=>{
    const{handler,client,repository}=setup();client.cast.mockRejectedValueOnce(new TvmazeError("tvmaze_http_429",429));await expect(handler.handle()).rejects.toThrow("tvmaze_http_429");expect(repository.publish).not.toHaveBeenCalled();
  });
  it("does not stage partial identity refresh results",async()=>{
    const{handler,repository,identities}=setup();repository.state.mockResolvedValue({identityMap:null,identitiesCheckedAt:null});identities.identities.mockRejectedValue(new Error("incomplete"));await expect(handler.handle()).rejects.toThrow("incomplete");expect(repository.identities).not.toHaveBeenCalled();expect(repository.publish).not.toHaveBeenCalled();
  });
});
