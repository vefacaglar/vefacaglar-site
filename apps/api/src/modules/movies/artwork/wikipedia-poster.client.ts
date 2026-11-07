import { injectable } from "tsyringe";
import type { MoviePoster } from "./commons-poster";
import { wikipediaArticleTitle, wikipediaPosterReferences, wikipediaPostersResponse, type WikipediaArticleCandidate, type WikipediaPosterReference } from "./wikipedia-poster";
import { wikidataRetryAfter } from "../import/wikidata-retry-after";

export const WIKIPEDIA_POSTER_CLIENT = Symbol("WikipediaPosterClient");
export interface IWikipediaPosterClient {
  resolveArticles(candidates: WikipediaArticleCandidate[], signal?: AbortSignal): Promise<Record<string, WikipediaPosterReference | null>>;
  fetchPosters(candidates: WikipediaPosterReference[], signal?: AbortSignal): Promise<Record<string, MoviePoster | null>>;
}
export class WikipediaPosterError extends Error {
  constructor(public readonly code: string, public readonly retryAfter?: Date) { super(code); }
}

@injectable()
export class WikipediaPosterClient implements IWikipediaPosterClient {
  private lastRequestAt = 0;
  private async request(parameters: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
    const wait = this.lastRequestAt + 1000 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.search = new URLSearchParams({ ...parameters, action: "query", redirects: "1", format: "json", formatversion: "2", maxlag: "5" }).toString();
    let response: Response;
    try { response = await fetch(url, { headers: { "User-Agent": "VefaLibrary/1.0 (+https://vefacaglar.com)", Accept: "application/json" },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000), redirect: "error" }); }
    catch { throw new WikipediaPosterError("wikipedia_artwork_request_failed", new Date(Date.now() + 60_000)); }
    const retryAfter = new Date(Math.max(Date.now() + 60_000, wikidataRetryAfter(response.headers.get("retry-after"))?.getTime() ?? 0));
    if (!response.ok) { await response.body?.cancel(); throw new WikipediaPosterError(`wikipedia_artwork_http_${response.status}`, retryAfter); }
    if (!response.body) throw new WikipediaPosterError("wikipedia_artwork_body_missing", retryAfter);
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 4 * 1024 * 1024) throw new Error("response_too_large");
        parts.push(next.value);
      }
      const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
      if (body?.error) throw new Error("provider_error");
      return body;
    } catch { throw new WikipediaPosterError("wikipedia_artwork_invalid_response", retryAfter); }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  async resolveArticles(candidates: WikipediaArticleCandidate[], signal?: AbortSignal) {
    if (!candidates.length || candidates.length > 5 || candidates.some((row) => typeof row.title !== "string" || !row.title.trim() || wikipediaArticleTitle(row.article) !== row.article || !/^Q[1-9]\d{0,20}$/.test(row.wikidataId))) throw new WikipediaPosterError("wikipedia_artwork_invalid_batch");
    const data = await this.request({ titles: [...new Set(candidates.map((row) => row.article))].join("|"), prop: "pageimages|pageprops",
      piprop: "name|thumbnail", pithumbsize: "300", pilicense: "any", ppprop: "wikibase_item" }, signal);
    return wikipediaPosterReferences(data, candidates);
  }
  async fetchPosters(candidates: WikipediaPosterReference[], signal?: AbortSignal) {
    if (!candidates.length || candidates.length > 5) throw new WikipediaPosterError("wikipedia_artwork_invalid_batch");
    const data = await this.request({ titles: [...new Set(candidates.map((row) => `File:${row.fileName}`))].join("|"),
      prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "300" }, signal);
    return wikipediaPostersResponse(data, candidates);
  }
}
