import { injectable } from "tsyringe";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { parseTvIdentities } from "./tv-popularity-ranking";
import type { TvPopularitySource } from "./tv-ranking";
const UA = "VefaLibrary/1.0 (+https://vefacaglar.com)";
const dayAt = (now: Date, offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
const expiry = (day: string) => new Date(Date.parse(day) + 3 * 86400_000).toISOString();
@injectable()
export class TvPopularityClient {
  private lastRequestAt = 0;
  private async response(url: URL, deadline: number) {
    if (!["https://files.tmdb.org", "https://query.wikidata.org", "https://wikimedia.org"].includes(url.origin)) throw new Error("tv_popularity_invalid_origin");
    const wait = this.lastRequestAt + 550 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    if (deadline <= Date.now()) throw new Error("tv_popularity_budget_exhausted");
    const response = await fetch(url, { redirect: "error", headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(Math.min(60000, deadline - Date.now())) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`tv_popularity_http_${response.status}`); }
    return response;
  }
  private async json(url: URL, limit: number, deadline: number) {
    const response = await this.response(url, deadline);
    if (!response.body) throw new Error("tv_popularity_empty_response");
    const reader = response.body.getReader(), parts: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) { const row = await reader.read(); if (row.done) break; size += row.value.byteLength; if (size > limit) throw new Error("tv_popularity_body_limit"); parts.push(row.value); }
      return JSON.parse(Buffer.concat(parts).toString("utf8"));
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  async identities(deadline: number) {
    const url = new URL("https://query.wikidata.org/sparql");
    url.search = new URLSearchParams({ format: "json", query: `SELECT ?item ?tvmaze ?tmdb ?article WHERE { ?item wdt:P8600 ?tvmaze; wdt:P4983 ?tmdb. OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. } }` }).toString();
    const raw = await this.json(url, 32 * 1024 * 1024, deadline);
    if (!Array.isArray(raw?.results?.bindings)) throw new Error("tv_identity_snapshot_invalid");
    return parseTvIdentities(raw.results.bindings.filter((row: any) => /^[1-9]\d*$/.test(row.tvmaze?.value ?? "") && /^[1-9]\d*$/.test(row.tmdb?.value ?? "")).map((row: any) => {
      if (!/^https?:\/\/www\.wikidata\.org\/entity\/Q[1-9]\d*$/.test(row.item?.value ?? "") || !/^[1-9]\d*$/.test(row.tvmaze?.value ?? "") || !/^[1-9]\d*$/.test(row.tmdb?.value ?? "")) throw new Error("tv_identity_snapshot_invalid");
      let article = null;
      if (row.article) {
        const url = new URL(row.article.value);
        if (url.origin !== "https://en.wikipedia.org" || !url.pathname.startsWith("/wiki/")) throw new Error("tv_identity_article_invalid");
        article = decodeURIComponent(url.pathname.slice(6));
      }
      return { seriesId: Number(row.tvmaze.value), tmdbId: Number(row.tmdb.value), article };
    }));
  }
  async tmdb(now: Date, deadline: number) {
    for (let offset = 0; offset < 3; offset++) {
      const day = dayAt(now, -offset), [year, month, date] = day.split("-");
      const url = new URL(`https://files.tmdb.org/p/exports/tv_series_ids_${month}_${date}_${year}.json.gz`);
      let response: Response;
      try { response = await this.response(url, deadline); }
      catch (error) { if (error instanceof Error && error.message === "tv_popularity_http_404") continue; throw error; }
      if (!response.body) throw new Error("tv_tmdb_empty_export");
      const values = new Map<number, number>();
      let compressed = 0, decoded = 0;
      const input = Readable.fromWeb(response.body as any);
      input.on("data", (chunk: Buffer) => { compressed += chunk.length; if (compressed > 64 * 1024 * 1024) input.destroy(new Error("tv_tmdb_body_limit")); });
      await pipeline(input, createGunzip(), async (stream) => {
        for await (const line of createInterface({ input: stream as Readable, crlfDelay: Infinity })) {
          decoded += Buffer.byteLength(line) + 1;
          if (decoded > 256 * 1024 * 1024 || values.size > 1000000 || line.length > 10000) throw new Error("tv_tmdb_body_limit");
          const row = JSON.parse(line);
          if (!Number.isSafeInteger(row.id) || row.id <= 0 || row.id > 2147483647 || typeof row.original_name !== "string" || !Number.isFinite(row.popularity) || row.popularity < 0 || values.has(row.id)) throw new Error("tv_tmdb_invalid_export");
          values.set(row.id, row.popularity);
        }
      });
      if (values.size < 10000) throw new Error("tv_tmdb_incomplete_export");
      const source: TvPopularitySource = { provider: "tmdb", sourceDate: day, windowStart: day, expiresAt: expiry(day), sourceUrl: url.href };
      return { values, source };
    }
    throw new Error("tv_tmdb_export_unavailable");
  }
  async wikipedia(now: Date, deadline: number) {
    const values = new Map<string, number>();
    // Seven complete UTC days, fetched in bulk; never one request per show.
    for (let offset = 7; offset >= 1; offset--) {
      const day = dayAt(now, -offset), [year, month, date] = day.split("-");
      const raw = await this.json(new URL(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${year}/${month}/${date}`), 1024 * 1024, deadline);
      const item = raw?.items?.[0];
      if (raw?.items?.length !== 1 || item.year !== year || item.month !== month || item.day !== date || !Array.isArray(item.articles) || item.articles.length < 500 || item.articles.length > 1000) throw new Error("tv_wikipedia_incomplete_window");
      const seen = new Set<string>();
      for (const row of item.articles) {
        if (typeof row.article !== "string" || !Number.isSafeInteger(row.views) || row.views < 0 || seen.has(row.article)) throw new Error("tv_wikipedia_invalid_row");
        seen.add(row.article); values.set(row.article, (values.get(row.article) ?? 0) + row.views);
      }
    }
    const source: TvPopularitySource = { provider: "wikipedia_top", sourceDate: dayAt(now, -1), windowStart: dayAt(now, -7), expiresAt: expiry(dayAt(now, -1)), sourceUrl: "https://wikimedia.org/api/rest_v1/#/Pageviews%20data/get_metrics_pageviews_top__project___access___year___month___day_" };
    return { values, source };
  }
}
