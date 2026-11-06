import { injectable } from "tsyringe";
import { wikidataRetryAfter } from "../import/wikidata-retry-after";
import { candidateSourceDays, normalizeArticleTitle, parseTitleMappings, parseTopArticles, projectObservations, sourceUrl, titleMappingBatches, titleMappingUrl } from "./wikipedia-interest";
import { MovieInterestSourceError, type InterestCollection, type IWikipediaInterestClient } from "./popularity.types";
const USER_AGENT = "VefaLibrary/1.0 (+https://vefacaglar.com)";
const MAX_REQUESTS = 30;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** A sparse top-article observation, never a worldwide film popularity measure. */
@injectable()
export class WikipediaInterestClient implements IWikipediaInterestClient {
  async collect(afterDate: string | null, options: { now?: Date; signal?: AbortSignal; beforeWikidata: () => Promise<Date | null> }): Promise<InterestCollection> {
    const started = Date.now();
    const now = options.now ?? new Date();
    const signal = AbortSignal.any([AbortSignal.timeout(120_000), ...(options.signal ? [options.signal] : [])]);
    let requests = 0;
    let lastRequestAt = 0;
    const request = async (url: URL, provider: "aqs" | "wikidata"): Promise<unknown> => {
      if (url.href.length > 6500) throw new MovieInterestSourceError(provider, "source_url_too_large");
      if (!["https://wikimedia.org", "https://www.wikidata.org"].includes(url.origin)) throw new MovieInterestSourceError(provider, "invalid_source_origin");
      if (signal.aborted || requests >= MAX_REQUESTS) throw new MovieInterestSourceError(provider, "source_request_budget_exhausted");
      if (provider === "wikidata") {
        const cooldown = await options.beforeWikidata();
        if (cooldown && cooldown.getTime() > Date.now()) throw new MovieInterestSourceError("wikidata", "wikidata_shared_cooldown", cooldown);
      }
      const wait = lastRequestAt + 500 - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (signal.aborted) throw new MovieInterestSourceError(provider, "source_deadline_exceeded");
      requests++;
      lastRequestAt = Date.now();
      let response: Response;
      try { response = await fetch(url, { redirect: "error", headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) }); }
      catch { throw new MovieInterestSourceError(provider, `${provider}_request_failed`); }
      const retryAt = new Date(Math.max(Date.now() + 30_000, wikidataRetryAfter(response.headers.get("retry-after"))?.getTime() ?? Date.now() + 60_000));
      if (!response.ok) {
        await response.body?.cancel();
        throw new MovieInterestSourceError(provider, `${provider}_http_${response.status}`, retryAt, response.status);
      }
      if (!response.headers.get("content-type")?.includes("json") || Number(response.headers.get("content-length") ?? 0) > MAX_BODY_BYTES || !response.body) {
        await response.body?.cancel();
        throw new MovieInterestSourceError(provider, `${provider}_invalid_response`);
      }
      let raw: any;
      const reader = response.body.getReader();
      try {
        const parts: Uint8Array[] = [];
        let bytes = 0;
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          bytes += next.value.byteLength;
          if (bytes > MAX_BODY_BYTES) throw new Error("body_limit");
          parts.push(next.value);
        }
        raw = JSON.parse(Buffer.concat(parts).toString("utf8"));
      } catch { throw new MovieInterestSourceError(provider, `${provider}_invalid_json_or_body`); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (raw?.error) {
        const code = raw.error.code === "maxlag" ? "maxlag" : "provider_error";
        throw new MovieInterestSourceError(provider, `${provider}_${code}`, retryAt);
      }
      return raw;
    };
    let sourceDate: string | null = null;
    let articles;
    for (const day of candidateSourceDays(afterDate, now)) {
      try { articles = parseTopArticles(await request(new URL(sourceUrl(day)), "aqs"), day); sourceDate = day; break; }
      catch (error) {
        if (error instanceof MovieInterestSourceError && error.provider === "aqs" && error.status === 404) continue;
        throw error;
      }
    }
    if (!sourceDate || !articles) return { status: "delayed", requests, durationMs: Date.now() - started };
    const uniqueTitles = [...new Set(articles.map((article) => normalizeArticleTitle(article.title)))];
    const mappings = new Map<string, string | null>();
    const batches = titleMappingBatches(uniqueTitles);
    if (requests + batches.length > MAX_REQUESTS) throw new MovieInterestSourceError("wikidata", "source_request_budget_exhausted");
    for (const titles of batches) {
      for (const [title, qid] of parseTitleMappings(await request(titleMappingUrl(titles), "wikidata"), titles)) mappings.set(title, qid);
    }
    if (signal.aborted) throw new MovieInterestSourceError("wikidata", "source_deadline_exceeded");
    const projected = projectObservations(articles, mappings);
    return { status: "complete", projection: { sourceDate, ...projected, requests, durationMs: Date.now() - started } };
  }
}
