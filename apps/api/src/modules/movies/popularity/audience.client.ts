import { injectable } from "tsyringe";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { wikidataRetryAfter } from "../import/wikidata-retry-after";
import { exactAudienceTitle, dateAfter, matchNetflixCandidate, rankAudienceItems } from "./audience-ranking";
import { isSourceDay, utcDay } from "./wikipedia-interest";
import { MovieAudienceError, type AudienceItem, type AudienceSnapshot, type IMovieAudienceClient, type NetflixCandidate } from "./audience.types";

const USER_AGENT = "VefaLibrary/1.0 (+https://vefacaglar.com)";
const NETFLIX_DATA = "https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv";
const FILM_CATEGORIES = ["Films (English)", "Films (Non-English)"];

/** Quoted TSV fields may contain tabs, newlines and doubled quotes. */
export function parseAudienceTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (character === "\t" || character === "\n")) {
      row.push(field.replace(/\r$/, "")); field = "";
      if (character === "\n") { rows.push(row); row = []; }
    } else field += character;
  }
  if (quoted) throw new MovieAudienceError("netflix_incomplete_tsv");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
export function parseNetflixAudience(text: string, now: Date): AudienceSnapshot {
  const rows = parseAudienceTsv(text.replace(/^\uFEFF/, ""));
  const header = rows.shift() ?? [];
  const required = ["week", "category", "weekly_rank", "show_title", "runtime", "weekly_views"];
  if (required.some((name) => !header.includes(name)) || new Set(header).size !== header.length) throw new MovieAudienceError("netflix_invalid_header");
  const records = rows.filter((row) => row.length > 1).map((row) => {
    if (row.length !== header.length) throw new MovieAudienceError("netflix_incomplete_row");
    return Object.fromEntries(header.map((name, index) => [name, row[index]]));
  });
  const week = records.map((row) => row.week).filter(isSourceDay).sort().at(-1);
  if (!week || week >= utcDay(now)) throw new MovieAudienceError("netflix_invalid_week");
  const films = records.filter((row) => row.week === week && FILM_CATEGORIES.includes(row.category));
  for (const category of FILM_CATEGORIES) {
    const ranks = films.filter((row) => row.category === category).map((row) => Number(row.weekly_rank)).sort((a, b) => a - b);
    if (JSON.stringify(ranks) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) throw new MovieAudienceError("netflix_incomplete_film_week");
  }
  const items = films.map((row) => {
    const runtime = Number(row.runtime) * 60;
    if (!row.show_title.trim() || row.show_title.length > 500 || !/^\d+$/.test(row.weekly_views)
      || !Number.isSafeInteger(Number(row.weekly_views)) || Number(row.weekly_views) <= 0 || !Number.isFinite(runtime) || runtime <= 0 || runtime > 1000) {
      throw new MovieAudienceError("netflix_invalid_film_observation");
    }
    return { externalId: JSON.stringify([week, row.category, row.show_title, row.runtime]), title: row.show_title,
      value: Number(row.weekly_views), runtimeMinutes: runtime };
  });
  return { provider: "netflix", sourceDate: week, windowStart: dateAfter(week, -6).slice(0, 10), expiresAt: dateAfter(week, 21),
    sourceUrl: NETFLIX_DATA, items: rankAudienceItems(items) };
}
function mappingResults(raw: any): Record<string, { value: string }>[] {
  if (!Array.isArray(raw?.results?.bindings) || raw.results.bindings.length > 5000) throw new MovieAudienceError("wikidata_invalid_audience_mapping", undefined, true);
  return raw.results.bindings;
}
function qid(value: string | undefined): string | null {
  const match = /^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d{0,20})$/.exec(value ?? "");
  return match?.[1] ?? null;
}
function htmlAttribute(tag: string, attribute: string): string | null {
  const match = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  return match?.[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(?:39|x27);/gi, "'") ?? null;
}
export function verifyNetflixNativeTitle(html: string, netflixId: string, title: string): boolean {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const metadata = new Map(tags.map((tag) => [htmlAttribute(tag, "property"), htmlAttribute(tag, "content")]));
  return metadata.get("og:url") === `https://www.netflix.com/title/${netflixId}`
    && exactAudienceTitle(metadata.get("og:title") ?? "") === exactAudienceTitle(`Watch ${title} | Netflix Official Site`);
}

@injectable()
export class MovieAudienceClient implements IMovieAudienceClient {
  private lastRequestAt = 0;
  private async response(url: URL, timeout: number, nativeTitle = false, deadline = Infinity) {
    if (!["https://files.tmdb.org", "https://www.netflix.com", "https://query.wikidata.org"].includes(url.origin) || url.href.length > 6500) {
      throw new MovieAudienceError("invalid_audience_origin");
    }
    const wait = this.lastRequestAt + 500 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    const remaining = Math.min(timeout, deadline - this.lastRequestAt);
    if (remaining <= 0) throw new MovieAudienceError("audience_request_budget_exhausted", undefined, url.hostname === "query.wikidata.org");
    let response: Response;
    try {
      response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(remaining), headers: {
        "User-Agent": nativeTitle ? `Mozilla/5.0 ${USER_AGENT}` : USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9", Accept: nativeTitle ? "text/html" : "*/*",
      } });
    } catch { throw new MovieAudienceError("audience_request_failed", undefined, url.hostname === "query.wikidata.org"); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new MovieAudienceError(`audience_http_${response.status}`, wikidataRetryAfter(response.headers.get("retry-after")) ?? undefined,
        url.hostname === "query.wikidata.org");
    }
    return response;
  }
  private async text(url: URL, limit: number, timeout = 20_000, nativeTitle = false, deadline = Infinity) {
    const response = await this.response(url, timeout, nativeTitle, deadline);
    if (!response.body || Number(response.headers.get("content-length") ?? 0) > limit) {
      await response.body?.cancel(); throw new MovieAudienceError("audience_body_limit");
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
        if (bytes > limit) throw new MovieAudienceError("audience_body_limit");
        parts.push(result.value);
      }
      return Buffer.concat(parts).toString("utf8");
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  private async sparql(query: string, beforeWikidata: () => Promise<void>, deadline: number) {
    await beforeWikidata();
    const url = new URL("https://query.wikidata.org/sparql");
    url.search = new URLSearchParams({ query, format: "json" }).toString();
    try { return mappingResults(JSON.parse(await this.text(url, 2 * 1024 * 1024, 20_000, false, deadline))); }
    catch (error) {
      if (error instanceof MovieAudienceError && error.wikidata) throw error;
      throw new MovieAudienceError("wikidata_invalid_audience_mapping", undefined, true);
    }
  }
  async tmdb(now: Date): Promise<AudienceSnapshot> {
    const deadline = Date.now() + 75_000;
    for (let days = 0; days < 3; days++) {
      const day = dateAfter(utcDay(now), -days).slice(0, 10);
      const [year, month, date] = day.split("-");
      const url = new URL(`https://files.tmdb.org/p/exports/movie_ids_${month}_${date}_${year}.json.gz`);
      let response: Response;
      try { response = await this.response(url, 60_000, false, deadline); }
      catch (error) { if (error instanceof MovieAudienceError && error.code === "audience_http_404") continue; throw error; }
      if (!response.body || Number(response.headers.get("content-length") ?? 0) > 96 * 1024 * 1024) {
        await response.body?.cancel(); throw new MovieAudienceError("tmdb_export_body_limit");
      }
      const top: Omit<AudienceItem, "rank">[] = [];
      let count = 0, decoded = 0, compressed = 0;
      const input = Readable.fromWeb(response.body as any);
      input.on("data", (chunk: Buffer) => {
        compressed += chunk.length;
        if (compressed > 96 * 1024 * 1024) input.destroy(new MovieAudienceError("tmdb_export_body_limit"));
      });
      try {
        await pipeline(input, createGunzip(), async (stream) => {
          for await (const line of createInterface({ input: stream as Readable, crlfDelay: Infinity })) {
            decoded += Buffer.byteLength(line) + 1;
            if (++count > 3_000_000 || decoded > 512 * 1024 * 1024 || line.length > 10_000) throw new MovieAudienceError("tmdb_export_body_limit");
            const row = JSON.parse(line);
            if (!Number.isSafeInteger(row.id) || row.id <= 0 || (row.adult !== null && typeof row.adult !== "boolean") || (row.video !== null && typeof row.video !== "boolean")
              || typeof row.original_title !== "string" || !Number.isFinite(row.popularity) || row.popularity < 0) throw new MovieAudienceError("tmdb_invalid_export_row");
            if (row.adult !== false || row.video !== false || row.popularity === 0) continue;
            if (top.length === 500 && row.popularity < top[top.length - 1].value) continue;
            if (top.some((item) => item.externalId === String(row.id))) throw new MovieAudienceError("tmdb_duplicate_export_id");
            top.push({ externalId: String(row.id), title: row.original_title, value: row.popularity });
            top.sort((a, b) => b.value - a.value || Number(a.externalId) - Number(b.externalId));
            if (top.length > 500) top.pop();
          }
        });
      } catch (error) {
        if (error instanceof MovieAudienceError) throw error;
        throw new MovieAudienceError("tmdb_incomplete_export");
      }
      if (count < 5000 || top.length !== 500) throw new MovieAudienceError("tmdb_incomplete_export");
      return { provider: "tmdb", sourceDate: day, windowStart: day, expiresAt: dateAfter(day, 3), sourceUrl: url.href, items: rankAudienceItems(top) };
    }
    throw new MovieAudienceError("tmdb_export_unavailable");
  }
  async netflix(now: Date) {
    return parseNetflixAudience(await this.text(new URL(NETFLIX_DATA), 8 * 1024 * 1024), now);
  }
  async tmdbIdentities(ids: string[], beforeWikidata: () => Promise<void>) {
    const deadline = Date.now() + 75_000;
    if (ids.length > 500 || ids.some((id) => !/^[1-9]\d{0,9}$/.test(id))) throw new MovieAudienceError("invalid_tmdb_mapping_ids");
    const found = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
    for (let offset = 0; offset < ids.length; offset += 100) {
      const rows = await this.sparql(`SELECT ?tmdb ?film WHERE { VALUES ?tmdb { ${ids.slice(offset, offset + 100).map((id) => JSON.stringify(id)).join(" ")} }
        ?film wdt:P4947 ?tmdb; wdt:P31 ?type . VALUES ?type { wd:Q11424 wd:Q202866 } }`, beforeWikidata, deadline);
      for (const row of rows) {
        const film = qid(row.film?.value), matches = found.get(row.tmdb?.value);
        if (!film || !matches) throw new MovieAudienceError("wikidata_invalid_tmdb_mapping", undefined, true);
        matches.add(film);
      }
    }
    return new Map([...found].map(([id, matches]) => [id, matches.size === 1 ? [...matches][0] : null]));
  }
  async netflixIdentities(items: AudienceItem[], beforeWikidata: () => Promise<void>) {
    const deadline = Date.now() + 75_000;
    if (items.length > 20) throw new MovieAudienceError("netflix_mapping_limit");
    const candidates: NetflixCandidate[] = [];
    for (let offset = 0; offset < items.length; offset += 10) {
      const labels = items.slice(offset, offset + 10).flatMap((item) => ["en", "mul"].map((language) => `${JSON.stringify(item.title)}@${language}`));
      const rows = await this.sparql(`SELECT ?film ?title ?netflix ?runtime WHERE { VALUES ?title { ${labels.join(" ")} }
        ?film rdfs:label ?title; wdt:P31 ?type . VALUES ?type { wd:Q11424 wd:Q202866 }
        OPTIONAL { ?film wdt:P1874 ?netflix } OPTIONAL { ?film wdt:P2047 ?runtime } }`, beforeWikidata, deadline);
      for (const row of rows) {
        const film = qid(row.film?.value);
        if (!film || !items.some((item) => exactAudienceTitle(item.title) === exactAudienceTitle(row.title?.value ?? ""))) throw new MovieAudienceError("wikidata_invalid_netflix_mapping", undefined, true);
        const runtime = row.runtime ? Number(row.runtime.value) : null;
        if (runtime !== null && (!Number.isFinite(runtime) || runtime <= 0)) throw new MovieAudienceError("wikidata_invalid_netflix_runtime", undefined, true);
        candidates.push({ wikidataId: film, title: row.title.value, runtimeMinutes: runtime,
          netflixId: /^\d{5,12}$/.test(row.netflix?.value ?? "") ? row.netflix.value : null });
      }
    }
    const verified = new Set<string>();
    const checked = new Set<string>();
    for (const item of items) {
      const native = candidates.filter((candidate) => candidate.runtimeMinutes === null && !!candidate.netflixId
        && exactAudienceTitle(candidate.title) === exactAudienceTitle(item.title));
      for (const candidate of native) {
        const id = candidate.netflixId!;
        if (checked.has(id) || checked.size >= 20 || Date.now() >= deadline) continue;
        checked.add(id);
        try {
          const html = await this.text(new URL(`https://www.netflix.com/title/${id}`), 2 * 1024 * 1024, 5000, true, deadline);
          if (verifyNetflixNativeTitle(html, id, item.title)) verified.add(id);
        } catch { /* Unverified native identity remains a miss. */ }
      }
    }
    return new Map(items.map((item) => [item.externalId, matchNetflixCandidate(item, candidates, verified)]));
  }
}
