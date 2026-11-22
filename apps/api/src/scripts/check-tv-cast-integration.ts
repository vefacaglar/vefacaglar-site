/** Opt-in shared actor identity/TV snapshot checks against disposable PostgreSQL. */
import "reflect-metadata";
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { schema } from "@vefacaglar/db";
import { DbProvider } from "../db.provider";
import { DrizzleTvCastRepository } from "../modules/tv-series/cast/tv-cast.repository";
import { parseTvCast } from "../modules/tv-series/cast/tv-cast-normalizer";
import { TvmazeRequestRepository } from "../modules/tv-series/import/tvmaze-request.repository";
import { DrizzleMoviesRepository } from "../modules/movies/movies.repository";
async function main() {
  const url=process.env.TV_TEST_DATABASE_URL;
  if(!url||!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!/test|verify|integration/.test(new URL(url).pathname))throw new Error("Use a disposable loopback TV_TEST_DATABASE_URL");
  const client=postgres(url,{max:5}),db=drizzle(client,{schema}),provider=new DbProvider(db),repository=new DrizzleTvCastRepository(provider);
  const id=2147481111,at=new Date(),sourceUrl=`https://www.tvmaze.com/shows/${id}/cast-fixture`;
  try {
    assert.equal((await db.execute(sql`select id from tv_series where id=${id}`)).length,0,"TV cast fixture already exists");
    await db.execute(sql`insert into tv_series(id,name,source_url,hierarchy_complete)values(${id},'Cast integration',${sourceUrl},true)`);
    const raw={person:{id:2147481110,name:"Cast Integration Actor",url:"https://www.tvmaze.com/people/2147481110/actor",birthday:"1980-01-02",gender:null,country:null},character:{id:2147481100,name:"One",url:"https://www.tvmaze.com/characters/2147481100/one"},self:false,voice:true};
    const rows=parseTvCast([raw,{...raw,character:{...raw.character,id:2147481101,url:"https://www.tvmaze.com/characters/2147481101/two",name:"Two"},voice:null}]);
    assert.throws(()=>parseTvCast([raw,raw]),/duplicate_role/);
    assert.throws(()=>parseTvCast([{...raw,person:{...raw.person,url:"https://www.tvmaze.com/people/22/wrong"}}]),/identity_mismatch/);
    await repository.publish({seriesId:id,requestedAt:at,sourceUrl},rows,new Map(),at,at);
    const [unknown]=await db.execute(sql`select p.id,p.wikidata_id from movie_people p join movie_person_sources s on s.person_id=p.id where s.external_id='2147481110'`);
    assert.equal(unknown.wikidata_id,null);
    assert.equal((await db.execute(sql`select count(*)::int n from tv_cast where series_id=${id}`))[0].n,2);
    // PostgreSQL keeps microseconds; Date truncation previously reselected the
    // same ten successful titles forever. Capture and acknowledge raw text.
    const stamp="2026-11-22 21:00:00.123456+00";
    await db.execute(sql`insert into tv_cast_queue(series_id,requested_at,due_at) values(${id},${stamp}::timestamptz,now()-interval '1 second') on conflict(series_id)do update set requested_at=excluded.requested_at,due_at=excluded.due_at`);
    const micro=(await repository.candidates(10000,new Date())).find(row=>row.seriesId===id)!;
    assert.equal(typeof micro.requestedAt,"string");
    assert.ok(String(micro.requestedAt).includes(".123456"));
    const [legacy]=await db.execute(sql`select requested_at<=${new Date(micro.requestedAt).toISOString()}::timestamptz as would_ack from tv_cast_queue where series_id=${id}`);
    assert.equal(legacy.would_ack,false,"regression must reproduce the former millisecond ACK failure");
    await repository.publish(micro,rows,new Map(),at,new Date());
    assert.ok(!(await repository.candidates(10000,new Date())).some(row=>row.seriesId===id),"successful cast must leave the candidate pool");
    await db.execute(sql`insert into tv_cast_queue(series_id,requested_at,due_at) values(${id},${stamp}::timestamptz,now()-interval '1 second')`);
    const oldMicro=(await repository.candidates(10000,new Date())).find(row=>row.seriesId===id)!;
    await db.execute(sql`update tv_cast_queue set requested_at=requested_at+interval '1 microsecond' where series_id=${id}`);
    await repository.publish(oldMicro,rows,new Map(),at,new Date());
    assert.equal((await db.execute(sql`select count(*)::int n from tv_cast_queue where series_id=${id}`))[0].n,1,"a one-microsecond newer wake must survive");
    const newMicro=(await repository.candidates(10000,new Date())).find(row=>row.seriesId===id)!;
    assert.ok(String(newMicro.requestedAt).includes(".123457"));
    await repository.publish(newMicro,rows,new Map(),at,new Date());
    assert.equal((await db.execute(sql`select count(*)::int n from tv_cast_queue where series_id=${id}`))[0].n,0);
    // Film ingestion remains QID-based and never claims people by their names.
    const qid="Q2147481110",movieQid="Q2147481111";
    await db.execute(sql`insert into movie_people(wikidata_id,name)values(${qid},'Cast Integration Actor')`);
    const [filmPerson]=await db.execute(sql`select id from movie_people where wikidata_id=${qid}`);
    const [film]=await db.execute(sql`insert into movies(wikidata_id,slug)values(${movieQid},'cast-integration-film')returning id`);
    const movies=new DrizzleMoviesRepository(provider);
    await movies.writeLabels({[qid]:"Cast Integration Actor"},at);
    await movies.persistMovie({wikidataId:movieQid,title:"Cast integration film",titleIsEnglish:true,originalTitle:null,description:null,imdbId:null,imdbConflict:false,posterFileName:null,commonsCategory:null,enwikiArticle:null,wikipediaLanguageCount:0,releaseDate:null,releaseYear:null,releasePrecision:null,runtimeMinutes:null,isFilm:true,sourceRevision:1,sourceModifiedAt:null,credits:[{statementId:"cast-integration-credit",personQid:qid,roleProperty:"P161",rank:"normal",qualifiers:{},characterNames:[],characterQids:[]}],companyQids:[],genreQids:[]},at);
    const result=await repository.publish({seriesId:id,requestedAt:at,sourceUrl},rows,new Map([[2147481110,{qid,method:"tvmaze_person_id"}]]),at,new Date());
    assert.equal(result.merged,1);
    const [alias]=await db.execute(sql`select person_id from movie_person_aliases where alias_id=${unknown.id}::uuid`);
    assert.equal(alias.person_id,filmPerson.id);
    assert.equal((await db.execute(sql`select count(*)::int n from tv_cast where series_id=${id} and person_id=${filmPerson.id}::uuid`))[0].n,2);
    assert.equal((await db.execute(sql`select person_id from movie_credits where movie_id=${film.id}::uuid`))[0].person_id,filmPerson.id);
    assert.equal((await db.execute(sql`select person_id from movie_person_sources where external_id='2147481110'`))[0].person_id,filmPerson.id);
    // Identity conflict rolls back the whole cast replacement, preserving all roles.
    await assert.rejects(()=>repository.publish({seriesId:id,requestedAt:at,sourceUrl},rows,new Map([[2147481110,{qid:"Q2147481112",method:"tvmaze_person_id"}]]),at,new Date()),/verified_identity_conflict/);
    assert.equal((await db.execute(sql`select count(*)::int n from tv_cast where series_id=${id}`))[0].n,2);
    await db.execute(sql`insert into tv_cast_queue(series_id,requested_at)values(${id},now()+interval '1 minute')on conflict(series_id)do update set requested_at=excluded.requested_at`);
    await repository.publish({seriesId:id,requestedAt:at,sourceUrl},rows,new Map(),at,new Date());
    assert.equal((await db.execute(sql`select count(*)::int n from tv_cast_queue where series_id=${id}`))[0].n,1);
    // Unknown TV-only people remain absent from film-only search, even if a bad
    // external writer attached a film credit to one without a Wikidata identity.
    const [tvOnly]=await db.execute(sql`insert into movie_people(name)values('Cast Integration Actor TVOnly')returning id`);
    await db.execute(sql`insert into movie_credits(movie_id,person_id,statement_id,role_property,rank)values(${film.id}::uuid,${tvOnly.id}::uuid,'tv-only-fixture','P161','normal')`);
    const summaries=await movies.searchPublicPeople("Cast Integration Actor",10);
    assert.ok(summaries.some(person=>person.wikidataId===qid));assert.ok(summaries.every(person=>person.wikidataId));assert.ok(!summaries.some(person=>person.name.includes("TVOnly")));
    const detail=await movies.findPublicBySlug((await db.execute(sql`select slug from movies where id=${film.id}::uuid`))[0].slug as string);
    assert.ok(detail?.credits.every(credit=>credit.wikidataId));
    // Shared provider reservations serialize independent worker generations.
    await db.execute(sql`update tv_source_state set next_request_at=null,cooldown_until=null where id='tvmaze'`);
    const gateA=new TvmazeRequestRepository(provider),gateB=new TvmazeRequestRepository(provider);
    const slots=await Promise.all([gateA.reserve(),gateB.reserve()]);
    assert.ok(Math.abs(slots[0].waitMs-slots[1].waitMs)>=450);
    await gateA.cooldown(new Date(Date.now()+60000));assert.ok((await gateB.reserve()).cooldownMs>50000);
    await db.execute(sql`update tv_source_state set next_request_at=null,cooldown_until=null where id='tvmaze'`);
    console.log("TV cast integration passed: lossless microsecond ACK and one-microsecond newer wake retention, nullable identities, multiple roles, real film importer reuse, atomic verified merge and UUID alias, conflict rollback, pending request retention, film-only filtering and shared provider pacing");
  } finally {await client.end({timeout:3});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
