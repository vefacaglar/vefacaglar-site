import { injectable } from "tsyringe";
import { commonsFileName, commonsPostersResponse, type MoviePoster } from "./commons-poster";
import { wikidataRetryAfter } from "../import/wikidata-retry-after";

export const COMMONS_POSTER_CLIENT = Symbol("CommonsPosterClient");
export interface ICommonsPosterClient {
  fetchPosters(names: string[], signal?: AbortSignal): Promise<Record<string, MoviePoster | null>>;
}
export class CommonsPosterError extends Error {
  constructor(public readonly code: string, public readonly retryAfter?: Date) { super(code); }
}

@injectable()
export class CommonsPosterClient implements ICommonsPosterClient {
  private lastRequestAt = 0;
  async fetchPosters(names: string[], signal?: AbortSignal): Promise<Record<string, MoviePoster | null>> {
    const files = [...new Set(names)];
    if (!files.length || files.length > 5 || files.some((name) => commonsFileName(name) !== name)) throw new CommonsPosterError("commons_invalid_batch");
    const wait = this.lastRequestAt + 1000 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({ action: "query", prop: "imageinfo", titles: files.map((name) => `File:${name}`).join("|"),
      iiprop: "url|mime|extmetadata", iiurlwidth: "500", redirects: "1", format: "json", formatversion: "2", maxlag: "5" }).toString();
    let response: Response;
    try {
      response = await fetch(url, { headers: { "User-Agent": "VefaLibrary/1.0 (+https://vefacaglar.com)", Accept: "application/json" },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000), redirect: "error" });
    } catch { throw new CommonsPosterError("commons_request_failed", new Date(Date.now() + 60_000)); }
    const retryAfter = new Date(Math.max(Date.now() + 60_000, wikidataRetryAfter(response.headers.get("retry-after"))?.getTime() ?? 0));
    if (!response.ok) {
      await response.body?.cancel();
      throw new CommonsPosterError(`commons_http_${response.status}`, retryAfter);
    }
    if (!response.body) throw new CommonsPosterError("commons_body_missing", retryAfter);
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
      return commonsPostersResponse(JSON.parse(Buffer.concat(parts).toString("utf8")), files);
    } catch { throw new CommonsPosterError("commons_invalid_response", retryAfter); }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
