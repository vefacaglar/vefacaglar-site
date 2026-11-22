import { currentTvCampaign } from "../daily/tv-campaign";
import { inject, injectable } from "tsyringe";
import { TvmazeClient, TvmazeError } from "./tvmaze.client";
import { TV_SOURCE_REPOSITORY, type ITvSourceRepository } from "./tvmaze.types";

@injectable()
export class SyncTvSeriesHandler {
  constructor(private readonly client: TvmazeClient, @inject(TV_SOURCE_REPOSITORY) private readonly repository: ITvSourceRepository) {}
  async prepareDaily(progress: (message:string)=>void=()=>{}) {
    const now=new Date(),state=await this.repository.state(now);
    progress("Capturing the daily TVmaze source changes");
    const updates=await this.client.updates(state.indexComplete?state.updatesCheckedAt:null,Date.now()+60000);
    if(!state.indexComplete&&!updates.length)throw new Error("tvmaze_empty_discovery_snapshot");
    await this.repository.updates(updates,now);
    return {discovery:!state.indexComplete,ceiling:updates.reduce((max,row)=>Math.max(max,row.id),0)};
  }
  async handle(progress: (message: string) => void = () => {}) {
    const deadline = Date.now() + 150_000;
    const state = await this.repository.state(new Date());
    const daily=currentTvCampaign();
    if(daily?.stage==="work")state.indexComplete=true;
    let discoveryComplete=state.indexComplete;
    if (state.cooldownUntil && state.cooldownUntil.getTime() > Date.now()) throw new TvmazeError("tvmaze_cooldown_active", null, state.cooldownUntil);
    const guarded = async <T>(operation: () => Promise<T>) => {
      try { return await operation(); }
      catch (error) {
        if (error instanceof TvmazeError && (error.status === 429 || (error.status ?? 0) >= 500 || error.code === "tvmaze_request_failed")) await this.repository.cooldown(error.retryAt);
        throw error;
      }
    };
    let pages = 0, shows = 0, hydrated = 0, failed = 0, missing = 0;
    if (!daily && (!state.updatesCheckedAt || state.updatesCheckedAt.getTime() < Date.now() - 20 * 3600_000)) {
      const capturedAt = new Date();
      progress("Checking TVmaze source updates");
      const updates = await guarded(() => this.client.updates(state.updatesCheckedAt, deadline));
      await this.repository.updates(updates, capturedAt);
      progress(`Queued source changes=${updates.length}`);
    }
    const hydrate = async (limit: number) => {
      const candidates = await this.repository.candidates(limit, new Date());
      for (const item of candidates) {
        if (Date.now() + 45_000 >= deadline) break;
        if(!daily)progress(`Hydrating TVmaze series id=${item.seriesId}`);
        try {
          const snapshot = await this.client.hierarchy(item.seriesId, deadline);
          await this.repository.hierarchy(item, snapshot, new Date());
          hydrated++;
          if(daily&&hydrated%10===0)progress(`Hierarchy chunk hydrated=${hydrated} failed=${failed} missing=${missing}`);
        } catch (error) {
          if (error instanceof TvmazeError && error.code === "tvmaze_budget_exhausted") break;
          if (error instanceof TvmazeError && error.status === 404) { await this.repository.missing(item, new Date()); missing++; }
          else if (error instanceof TvmazeError && (error.status === 429 || (error.status ?? 0) >= 500 || error.code === "tvmaze_request_failed")) {
            await this.repository.cooldown(error.retryAt);
            throw error;
          } else {
            await this.repository.failure(item, error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : "tvmaze_hierarchy_invalid", new Date(Date.now() + 86400_000));
            failed++;
          }
        }
      }
    };
    // Popular and explicitly requested shows are hydrated before the bulk index,
    // and half of every candidate batch advances the oldest remaining work.
    if(daily?.stage!=="discover")await hydrate(24);
    if(daily?.stage==="discover"&&state.nextPage>Math.floor((daily.ceiling??0)/250)&&!state.indexComplete){await this.repository.completeIndex(new Date());discoveryComplete=true;}
    if (!state.indexComplete&&!discoveryComplete) {
      for (let page = state.nextPage; pages < 40 && Date.now() + 20_000 < deadline; page++) {
        const batch = await guarded(() => this.client.page(page, deadline));
        if (batch === null) {
          if (page === 0) throw new TvmazeError("tvmaze_empty_catalog");
          await this.repository.completeIndex(new Date());
          discoveryComplete=true;
          progress("TVmaze catalog index pass completed");
          break;
        }
        await this.repository.indexPage(page, daily?batch.filter(show=>show.id<=(daily.ceiling??0)):batch, new Date());
        pages++;
        shows += batch.length;
        progress(`Catalog page=${page} shows=${shows}`);
        if(daily&&page>=Math.floor((daily.ceiling??0)/250)){await this.repository.completeIndex(new Date());discoveryComplete=true;break;}
      }
    }
    if(daily?.stage!=="discover")await hydrate(Math.max(0, 60 - hydrated));
    const hasMore = await this.repository.hasMore(new Date());
    return { pages, shows, hydrated, failed, missing, discoveryComplete, hasMore, progressMade: pages + hydrated + missing + failed > 0 };
  }
}
