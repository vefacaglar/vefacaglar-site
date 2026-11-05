import { injectable } from "tsyringe";
import { wikidataRetryAfter } from "./wikidata-retry-after";
import { isQid, sourceLabel } from "./wikidata-normalizer";
import type { EntityLabels, IWikidataEntityClient } from "./movie-source.types";

const API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "VefaLibrary/1.0 (+https://vefacaglar.com)";
export class MovieSourceError extends Error {
  constructor(public readonly code: string, public readonly retryAfter?: Date) { super(code); }
}

@injectable()
export class WikidataEntityClient implements IWikidataEntityClient {
  private lastRequestAt = 0;
  private async request(qids: string[], props: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (!qids.length || qids.length > 50 || qids.some((qid) => !isQid(qid))) throw new MovieSourceError("invalid_entity_batch");
    const delay = this.lastRequestAt + 500 - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    this.lastRequestAt = Date.now();
    const url = new URL(API);
    url.search = new URLSearchParams({ action: "wbgetentities", ids: [...new Set(qids)].join("|"), props, languages: "en", languagefallback: "1", format: "json", maxlag: "5" }).toString();
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
    let response: Response;
    try { response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: requestSignal, redirect: "error" }); }
    catch { throw new MovieSourceError("wikidata_request_failed", new Date(Date.now() + 60_000)); }
    const cooldown = new Date(Math.max(Date.now() + 30_000,
      wikidataRetryAfter(response.headers.get("retry-after"))?.getTime() ?? Date.now() + 60_000));
    if (!response.ok) {
      await response.body?.cancel();
      throw new MovieSourceError(`wikidata_http_${response.status}`, cooldown);
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 24 * 1024 * 1024) {
      await response.body?.cancel();
      throw new MovieSourceError("wikidata_response_too_large");
    }
    let data: any;
    try {
      if (!response.body) throw new Error("body_missing");
      const reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          bytes += next.value.byteLength;
          if (bytes > 24 * 1024 * 1024) throw new MovieSourceError("wikidata_response_too_large");
          parts.push(next.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      data = JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch (error) {
      if (error instanceof MovieSourceError) throw error;
      throw new MovieSourceError("wikidata_invalid_json");
    }
    if (data?.error) throw new MovieSourceError(`wikidata_${typeof data.error.code === "string" ? data.error.code.replace(/[^a-z0-9_-]/gi, "").slice(0, 50) : "provider_error"}`, cooldown);
    if (!data?.entities || typeof data.entities !== "object" || Array.isArray(data.entities)) throw new MovieSourceError("wikidata_missing_entities");
    return data.entities;
  }
  fetchEntities(qids: string[], options: { signal?: AbortSignal } = {}): Promise<Record<string, unknown>> {
    return this.request(qids, "info|claims|labels|descriptions", options.signal);
  }
  async fetchLabels(qids: string[], options: { signal?: AbortSignal } = {}): Promise<EntityLabels> {
    const entities = await this.request(qids, "labels", options.signal);
    return Object.fromEntries(qids.map((qid) => [qid, sourceLabel(entities[qid])]));
  }
}
