import { injectable } from "tsyringe";
import { wikidataRetryAfter } from "../import/wikidata-retry-after";
import { articleViewsUrl, parseArticleViews, candidateSourceDays, normalizeArticleTitle, parseTitleMappings, parseTopArticles, projectObservations, sourceUrl, titleMappingBatches, titleMappingUrl } from "./wikipedia-interest";
import { MovieInterestSourceError, type InterestCandidate, type InterestCollection, type IWikipediaInterestClient } from "./popularity.types";
const USER_AGENT = "VefaLibrary/1.0 (+https://vefacaglar.com)";
const MAX_REQUESTS = 96;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Bounded current article interest, measured over three completed UTC days. */
@injectable()
export class WikipediaInterestClient implements IWikipediaInterestClient {
  async collect(afterDate: string | null, options: { now?: Date; signal?: AbortSignal; candidates?: InterestCandidate[]; knownMovieQids: (qids: string[]) => Promise<string[]>; beforeWikidata: () => Promise<Date | null> }): Promise<InterestCollection> {
    const started = Date.now();
    const now = options.now ?? new Date();
    const signal = AbortSignal.any([AbortSignal.timeout(120_000), ...(options.signal ? [options.signal] : [])]);
    let requests = 0;
    let lastRequestAt = 0;
    const request = async (url: URL, provider: "aqs" | "wikidata", extraSignal?: AbortSignal): Promise<unknown> => {
      if (url.href.length > 6500) throw new MovieInterestSourceError(provider, "source_url_too_large");
      if (!["https://wikimedia.org", "https://www.wikidata.org"].includes(url.origin)) throw new MovieInterestSourceError(provider, "invalid_source_origin");
      if (signal.aborted || extraSignal?.aborted || requests >= MAX_REQUESTS) throw new MovieInterestSourceError(provider, "source_request_budget_exhausted");
      if (provider === "wikidata") {
        const cooldown = await options.beforeWikidata();
        if (cooldown && cooldown.getTime() > Date.now()) throw new MovieInterestSourceError("wikidata", "wikidata_shared_cooldown", cooldown);
      }
      const wait = lastRequestAt + 500 - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (signal.aborted || extraSignal?.aborted) throw new MovieInterestSourceError(provider, "source_deadline_exceeded");
      requests++;
      lastRequestAt = Date.now();
      let response: Response;
      try { response = await fetch(url, { redirect: "error", headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.any([signal, AbortSignal.timeout(15_000), ...(extraSignal ? [extraSignal] : [])]) }); }
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
    // The global feed only discovers candidates. All published scores measure
    // the same three completed UTC days, using comparable human pageviews.
    const known = new Set(await options.knownMovieQids(projected.observations.map((row) => row.wikidataId)));
    const articleByQid = new Map<string, { title: string; views: number }>();
    for (const article of articles) {
      const qid = mappings.get(normalizeArticleTitle(article.title));
      if (qid && article.views > (articleByQid.get(qid)?.views ?? -1)) articleByQid.set(qid, article);
    }
    const leaders = projected.observations.filter((row) => known.has(row.wikidataId))
      .sort((a, b) => b.views - a.views || a.wikidataId.localeCompare(b.wikidataId)).slice(0, 48);
    const rollingObservations: { wikidataId: string; views: number }[] = [];
    const measure = async (candidate: InterestCandidate, extraSignal?: AbortSignal) => {
      try {
        const views = parseArticleViews(await request(articleViewsUrl(candidate.article, sourceDate), "aqs", extraSignal), candidate.article, sourceDate);
        if (views !== null) rollingObservations.push({ wikidataId: candidate.wikidataId, views });
      } catch (error) {
        if (error instanceof MovieInterestSourceError && error.status === 404) return;
        throw error;
      }
    };
    for (const leader of leaders) await measure({ wikidataId: leader.wikidataId, article: articleByQid.get(leader.wikidataId)!.title });
    const measuredLeaders = rollingObservations.length;
    const selected = new Set(leaders.map((row) => row.wikidataId));
    const supplementSignal = AbortSignal.timeout(20_000);
    let additionalErrorCode: string | undefined;
    let additionalRetryAt: string | undefined;
    for (const candidate of (options.candidates ?? []).slice(0, 16)) {
      if (selected.has(candidate.wikidataId)) continue;
      selected.add(candidate.wikidataId);
      try { await measure(candidate, supplementSignal); }
      catch (error) {
        if (options.signal?.aborted) throw error;
        // Optional coverage cannot prevent publishing the fully measured leaders.
        rollingObservations.length = measuredLeaders;
        additionalErrorCode = error instanceof MovieInterestSourceError ? error.code : "article_coverage_unavailable";
        additionalRetryAt = error instanceof MovieInterestSourceError ? error.retryAt.toISOString() : undefined;
        break;
      }
    }
    return { status: "complete", projection: { sourceDate, ...projected, rollingObservations,
      additionalObservationCount: rollingObservations.length - measuredLeaders, additionalErrorCode, additionalRetryAt,
      requests, durationMs: Date.now() - started } };
  }
}
