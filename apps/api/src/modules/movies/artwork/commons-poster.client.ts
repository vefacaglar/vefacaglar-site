import { injectable } from "tsyringe";
import { commonsFileName, commonsPostersResponse, type MoviePoster } from "./commons-poster";
import { CATEGORY_MEMBER_LIMIT, POSTER_SUBCATEGORY_MEMBER_LIMIT, commonsCategoryName, commonsCategoryPosterResponse, type CommonsCategoryPosterResult } from "./commons-category-poster";
import { wikidataRetryAfter } from "../import/wikidata-retry-after";

export const COMMONS_POSTER_CLIENT = Symbol("CommonsPosterClient");
export interface ICommonsPosterClient {
  fetchPosters(names: string[], signal?: AbortSignal): Promise<Record<string, MoviePoster | null>>;
  /**
   * One bounded request listing a film's Commons category (or, with `posterSubcategoryOf`,
   * one of its poster subcategories) and returning a strictly verified free poster, if any.
   */
  fetchCategoryPoster(category: string, options: { posterSubcategoryOf?: string }, signal?: AbortSignal): Promise<CommonsCategoryPosterResult>;
}
export class CommonsPosterError extends Error {
  constructor(public readonly code: string, public readonly retryAfter?: Date) { super(code); }
}

const EXTMETADATA = "Artist|LicenseShortName|LicenseUrl|NonFree|Restrictions|Copyrighted|Categories";

@injectable()
export class CommonsPosterClient implements ICommonsPosterClient {
  private lastRequestAt = 0;
  private async request<T>(parameters: Record<string, string>, parse: (body: unknown) => T, signal?: AbortSignal): Promise<T> {
    const wait = this.lastRequestAt + 1000 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({ action: "query", ...parameters, format: "json", formatversion: "2", maxlag: "5" }).toString();
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
      return parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
    } catch { throw new CommonsPosterError("commons_invalid_response", retryAfter); }
    finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  async fetchPosters(names: string[], signal?: AbortSignal): Promise<Record<string, MoviePoster | null>> {
    const files = [...new Set(names)];
    if (!files.length || files.length > 5 || files.some((name) => commonsFileName(name) !== name)) throw new CommonsPosterError("commons_invalid_batch");
    return this.request({ prop: "imageinfo", titles: files.map((name) => `File:${name}`).join("|"),
      iiprop: "url|mime|extmetadata", iiurlwidth: "500", redirects: "1" }, (body) => commonsPostersResponse(body, files), signal);
  }
  async fetchCategoryPoster(category: string, options: { posterSubcategoryOf?: string }, signal?: AbortSignal): Promise<CommonsCategoryPosterResult> {
    const film = options.posterSubcategoryOf ?? category;
    if (commonsCategoryName(category) !== category || commonsCategoryName(film) !== film) throw new CommonsPosterError("commons_invalid_batch");
    const subcategory = options.posterSubcategoryOf !== undefined;
    return this.request({ generator: "categorymembers", gcmtitle: `Category:${category}`, gcmtype: subcategory ? "file" : "subcat|file",
      gcmlimit: String(subcategory ? POSTER_SUBCATEGORY_MEMBER_LIMIT : CATEGORY_MEMBER_LIMIT), prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata", iiurlwidth: "500", iiextmetadatafilter: EXTMETADATA },
    (body) => commonsCategoryPosterResponse(body, film, subcategory), signal);
  }
}
