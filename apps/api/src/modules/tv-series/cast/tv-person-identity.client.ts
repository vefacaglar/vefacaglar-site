import { injectable } from "tsyringe";
import { parseTvPersonIdentities, type CastBirthdateCandidate } from "./tv-cast-normalizer";
@injectable()
export class TvPersonIdentityClient {
  private lastRequestAt=0;
  private async query(query:string,deadline:number) {
    const wait=this.lastRequestAt+1000-Date.now();if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));this.lastRequestAt=Date.now();
    if(deadline<=Date.now())throw new Error("tv_person_identity_budget_exhausted");
    const url=new URL("https://query.wikidata.org/sparql");url.search=new URLSearchParams({query,format:"json"}).toString();
    const response=await fetch(url,{redirect:"error",headers:{"User-Agent":"VefaLibrary/1.0 (+https://vefacaglar.com)",Accept:"application/sparql-results+json"},signal:AbortSignal.timeout(Math.min(45000,deadline-Date.now()))});
    if(!response.ok){await response.body?.cancel();throw new Error(`tv_person_identity_http_${response.status}`);}
    if(!response.body)throw new Error("tv_person_identity_empty_response");
    const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
    try{for(;;){const row=await reader.read();if(row.done)break;size+=row.value.byteLength;if(size>24*1024*1024)throw new Error("tv_person_identity_body_limit");parts.push(row.value);}
      const raw=JSON.parse(Buffer.concat(parts).toString("utf8"));if(!Array.isArray(raw?.results?.bindings)||raw.results.bindings.length>100000)throw new Error("tv_person_identity_incomplete_response");return raw.results.bindings as Record<string,{value:string}>[];
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  async identities(deadline:number) {
    const rows=await this.query("SELECT ?person ?tvmaze WHERE { ?person wdt:P11449 ?tvmaze. }",deadline);
    return parseTvPersonIdentities(rows.filter(row=>/^[1-9]\d{0,9}$/.test(row.tvmaze?.value??"")).map(row=>{
      const qid=/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d{0,20})$/.exec(row.person?.value??"")?.[1];
      if(!qid)throw new Error("tv_person_identity_invalid_qid");return{externalId:Number(row.tvmaze.value),qid};
    }));
  }
  async castBirthdates(seriesIds:number[],deadline:number):Promise<CastBirthdateCandidate[]> {
    if(!seriesIds.length)return[];
    if(seriesIds.length>10||seriesIds.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error("tv_person_cast_mapping_batch_invalid");
    const rows=await this.query(`SELECT ?series ?show ?person ?name ?birth WHERE { VALUES ?series { ${seriesIds.map(id=>JSON.stringify(String(id))).join(" ")} }
      ?show wdt:P8600 ?series; wdt:P161 ?person. FILTER NOT EXISTS { ?other wdt:P8600 ?series. FILTER(?other!=?show) } ?person rdfs:label ?name; p:P569 ?birthStatement. ?birthStatement wikibase:rank ?rank; psv:P569 ?value. FILTER(?rank!=wikibase:DeprecatedRank)
      FILTER(LANG(?name)="en") ?value wikibase:timePrecision 11; wikibase:timeValue ?birth. }`,deadline);
    return rows.map(row=>{
      const showQid=/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d{0,20})$/.exec(row.show?.value??"")?.[1];
      const qid=/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d{0,20})$/.exec(row.person?.value??"")?.[1];
      const seriesId=Number(row.series?.value),birthDate=row.birth?.value?.slice(0,10);
      if(!showQid||!qid||!seriesIds.includes(seriesId)||!row.name?.value||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate??"")||!Number.isFinite(Date.parse(birthDate)))throw new Error("tv_person_cast_mapping_invalid");
      return{seriesId,showQid,qid,name:row.name.value,birthDate};
    });
  }
}
