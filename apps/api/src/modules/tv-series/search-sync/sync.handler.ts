import { inject, injectable } from "tsyringe";
import { TvIndexClient } from "./tv-index.client";
import { TV_INDEX_REPOSITORY, type ITvIndexRepository } from "./tv-index.repository";
@injectable()
export class SyncTvIndexHandler {
  constructor(private readonly client: TvIndexClient, @inject(TV_INDEX_REPOSITORY) private readonly repository: ITvIndexRepository) {}
  async handle(progress: (message: string) => void = () => {}) {
    if (!await this.repository.needed()) return { published:false, documents: 0, hasMore: false, progressMade: false };
    let deadline = Date.now() + 120000;
    let state = await this.repository.start(), documents = 0, batches = 0,published=false;
    const index = state.buildIndex!;
    if (state.phase !== "swap") {
      if((state.scanCursor!==null||state.phase!=="scan")&&!await this.client.exists(index))throw new Error("tv_index_staged_build_missing");
      await this.client.configure(index);
    }
    deadline=Date.now()+120000;
    while (Date.now() + 30000 < deadline && batches < 40) {
      await this.repository.assertLease();
      if (state.phase === "scan") {
        const page = await this.repository.page(state.scanCursor, 1000);
        await this.client.documents(index, page.documents);
        const cursor = page.ids.at(-1) ?? state.scanCursor;
        await this.repository.advance(index, cursor, !page.ids.length,page.ids.length);
        documents += page.documents.length; batches++;
        progress(`Index scan documents=${documents} cursor=${cursor ?? 0}`);
      } else if (state.phase === "dirty") {
        const dirty = await this.repository.dirty(1000);
        if (dirty.length) {
          const docs = await this.repository.documents(dirty.map((row) => row.seriesId));
          const existing = new Set(docs.map((row) => (row as { id: number }).id));
          await this.client.documents(index, docs);
          await this.client.remove(index, dirty.filter((row) => !existing.has(row.seriesId)).map((row) => row.seriesId));
          await this.repository.acknowledge(dirty);
          documents += docs.length; batches++;
          progress(`Index changed rows=${dirty.length}`);
        } else {
          const ready = await this.repository.prepareSwap(index);
          if (!ready) continue;
        }
      } else if (state.phase === "swap") {
        await this.client.settleSwap();
        if (await this.client.marker("tv_series_en") !== state.buildToken) {
          await this.client.documents(index, [{ id: 0, kind: "metadata", buildToken: state.buildToken }]);
          await this.repository.assertLease();
          await this.client.swap(index);
        }
        if (await this.client.marker("tv_series_en") !== state.buildToken) throw new Error("tv_index_swap_marker_mismatch");
        await this.repository.finishSwap(index);
        // This UID now refers to the replaced live index, never the new live one.
        await this.client.discard(index).catch(() => {});
        published=true;
        progress("Published complete TV series index");
        break;
      } else throw new Error("tv_index_phase_invalid");
      state = await this.repository.state();
    }
    const hasMore = await this.repository.needed();
    return { published, documents, hasMore, progressMade: batches > 0 || state.phase === "swap" };
  }
}
