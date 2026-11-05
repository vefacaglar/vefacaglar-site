import { injectable } from "tsyringe";
import {
  FILM_DISCOVERY_STRATEGY,
  type FilmDiscoveryResult,
  type IFilmDiscoveryClient,
} from "./wikidata-discovery.types";

const ENDPOINT = "https://query.wikidata.org/sparql";
// A complete unordered projection avoids an unstable LIMIT/OFFSET pseudo-cursor.
// This intentionally discovers direct films only, not every film subclass.
const QUERY = "SELECT ?film WHERE { ?film wdt:P31 wd:Q11424 . }";
const MAX_BODY_BYTES = 48 * 1024 * 1024;
const BATCH_SIZE = 1000;
const USER_AGENT = "VefaLibrary/1.0 (+https://vefacaglar.com)";

export class FilmDiscoveryError extends Error {
  constructor(message: string, public readonly retryAfter?: Date) {
    super(message);
    this.name = "FilmDiscoveryError";
  }
}

@injectable()
export class WikidataFilmDiscoveryClient implements IFilmDiscoveryClient {
  async discover(
    onBatch: (wikidataIds: string[]) => Promise<void>,
    options: { signal?: AbortSignal; maxRequests?: number } = {},
  ): Promise<FilmDiscoveryResult> {
    const result = { complete: false, discovered: 0, strategy: FILM_DISCOVERY_STRATEGY };
    if (options.signal?.aborted || (options.maxRequests ?? 1) < 1) return result;
    const signal = AbortSignal.any([AbortSignal.timeout(40_000), ...(options.signal ? [options.signal] : [])]);
    const url = new URL(ENDPOINT);
    url.searchParams.set("query", QUERY);
    url.searchParams.set("format", "json");
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
      redirect: "error",
      signal,
    });
    if (!response.ok) {
      const raw = response.headers.get("retry-after");
      const seconds = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
      const date = raw ? new Date(raw) : null;
      const retryAfter = Number.isFinite(seconds)
        ? new Date(Date.now() + seconds * 1000)
        : date && Number.isFinite(date.getTime()) ? date
        : [429, 503].includes(response.status) ? new Date(Date.now() + 60_000) : undefined;
      await response.body?.cancel();
      throw new FilmDiscoveryError(`Wikidata film discovery returned HTTP ${response.status}`, retryAfter);
    }
    if (!response.headers.get("content-type")?.startsWith("application/sparql-results+json")) {
      await response.body?.cancel();
      throw new FilmDiscoveryError("Wikidata film discovery returned an unsupported response format");
    }
    if (!response.body) throw new FilmDiscoveryError("Wikidata film discovery returned no body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          throw new FilmDiscoveryError("Wikidata film discovery exceeded its bounded response size");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    // Parse only after verified EOF; a truncated response must never complete a cycle.
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { throw new FilmDiscoveryError("Wikidata film discovery returned incomplete JSON"); }
    text = "";
    const parsed = body as { head?: { vars?: unknown }; results?: { bindings?: unknown } } | null;
    if (!parsed || !Array.isArray(parsed.head?.vars) || parsed.head.vars.length !== 1 ||
        parsed.head.vars[0] !== "film" || !Array.isArray(parsed.results?.bindings) || parsed.results.bindings.length === 0) {
      throw new FilmDiscoveryError("Wikidata film discovery returned an invalid result envelope");
    }
    const seen = new Set<string>();
    let batch: string[] = [];
    for (const row of parsed.results.bindings) {
      if (options.signal?.aborted) return result;
      const film = (row as { film?: { type?: unknown; value?: unknown } } | null)?.film;
      const match = typeof film?.value === "string" && film.type === "uri"
        ? /^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/.exec(film.value)
        : null;
      if (!match) throw new FilmDiscoveryError("Wikidata film discovery returned an invalid film identifier");
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      batch.push(match[1]);
      if (batch.length === BATCH_SIZE) {
        await onBatch(batch);
        result.discovered += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      if (options.signal?.aborted) return result;
      await onBatch(batch);
      result.discovered += batch.length;
    }
    result.complete = !options.signal?.aborted;
    return result;
  }
}
