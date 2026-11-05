import { randomUUID } from "node:crypto";
import { inject, injectable } from "tsyringe";
import { HLTB_LOOKUPS_REPOSITORY, HltbProviderUnavailable, type IHltbLookupsRepository } from "../hltb/hltb.types";
import { normalizeTitle, type HltbPopularityGame, type IHltbClient, type ImportedTimes } from "./import.types";
import { hltbApiPath, hltbScriptUrls, parseHltbGames, parseHltbSession, type HltbSession } from "./hltb-data";

const BASE_URL = "https://howlongtobeat.com";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const PAGE_SIZE = 20;
const MAX_POPULAR_PAGES = 5;
const REQUEST_TIMEOUT_MS = 10_000;

/** Best-effort public website integration, not an official/stable developer API. */
@injectable()
export class HltbClient implements IHltbClient {
  private session: HltbSession | null = null;
  private sessionAt = 0;
  private searchPath: string | null = null;
  constructor(@inject(HLTB_LOOKUPS_REPOSITORY) private readonly permits: IHltbLookupsRepository) {}

  async searchCandidates(title: string): Promise<HltbPopularityGame[]> {
    const query = title.trim().replace(/\s+/g, " ");
    if (!query || query.length > 250) throw new Error("A game title of at most 250 characters is required");
    try { return await this.search(query, 1, AbortSignal.timeout(30_000)); }
    catch (error) { return this.unavailable(error); }
  }

  async findTimes(title: string): Promise<ImportedTimes | null> {
    const wanted = normalizeTitle(title);
    if (!wanted) return null;
    const matches = (await this.searchCandidates(title)).filter((g) => normalizeTitle(g.title) === wanted);
    return matches.length === 1 ? matches[0].times : null;
  }

  async listPopular(): Promise<HltbPopularityGame[]> {
    const games = new Map<number, HltbPopularityGame>();
    const signal = AbortSignal.timeout(90_000);
    try {
      for (let page = 1; page <= MAX_POPULAR_PAGES; page++) {
        const rows = await this.search("", page, signal);
        const before = games.size;
        for (const game of rows) games.set(game.hltbId, game);
        if (rows.length < PAGE_SIZE || games.size === before) break;
      }
      return [...games.values()];
    } catch (error) { return this.unavailable(error); }
  }

  private async unavailable(error: unknown): Promise<never> {
    if (error instanceof HltbProviderUnavailable) throw error;
    const until = new Date(Date.now() + 60_000);
    await this.permits.deferProvider(until);
    throw new HltbProviderUnavailable(until);
  }

  private async search(title: string, page: number, signal: AbortSignal): Promise<HltbPopularityGame[]> {
    // Expired or blocked sessions fail fast; a later lookup renews after cooldown.
    const session = await this.getSession(signal);
    const payload: Record<string, unknown> = {
      searchType: "games", searchTerms: title.trim() ? title.trim().split(/\s+/) : [], searchPage: page, size: PAGE_SIZE,
      searchOptions: {
        games: {
          userId: 0, platform: "", sortCategory: "popular", rangeCategory: "main", rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" }, rangeYear: { min: "", max: "" }, modifier: "hide_dlc",
        },
        users: { sortCategory: "postcount" }, lists: { sortCategory: "follows" }, filter: "", sort: 0, randomizer: 0,
      },
      useCache: true,
    };
    if (session.key && session.value !== null) payload[session.key] = session.value;
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-auth-token": session.token };
    if (session.key && session.value !== null) { headers["x-hp-key"] = session.key; headers["x-hp-val"] = String(session.value); }
    const res = await this.request(this.searchPath!, { method: "POST", headers, body: JSON.stringify(payload) }, signal);
    if (!res.ok) throw new Error(`HLTB search failed: ${res.status}`);
    return parseHltbGames(await res.json()).slice(0, PAGE_SIZE);
  }

  private async getSession(signal: AbortSignal): Promise<HltbSession> {
    if (this.session && Date.now() - this.sessionAt < 15 * 60_000) return this.session;
    const searchPath = await this.discoverSearchPath(signal);
    const res = await this.request(`${searchPath}/init?t=${Date.now()}`, {}, signal);
    if (!res.ok) throw new Error(`HLTB session request failed: ${res.status}`);
    this.session = parseHltbSession(await res.json());
    this.sessionAt = Date.now();
    return this.session;
  }

  private async discoverSearchPath(signal: AbortSignal): Promise<string> {
    if (this.searchPath) return this.searchPath;
    const home = await this.request("/", {}, signal);
    if (!home.ok) throw new Error(`HLTB website request failed: ${home.status}`);
    for (const script of hltbScriptUrls(await home.text())) {
      const res = await this.request(script, {}, signal);
      if (!res.ok) continue;
      const path = hltbApiPath(await res.text());
      if (path) { this.searchPath = path; return path; }
    }
    this.searchPath = "/api/search/site";
    return this.searchPath;
  }

  private async request(path: string, init: RequestInit = {}, signal: AbortSignal): Promise<Response> {
    const url = new URL(path, BASE_URL);
    if (url.origin !== BASE_URL) throw new Error("HLTB request must stay on its public website");
    const owner = randomUUID();
    let permit = await this.permits.acquireProviderPermit(owner);
    if (!permit.acquired && permit.retryAt.getTime() - Date.now() <= 1000) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, permit.retryAt.getTime() - Date.now())));
      permit = await this.permits.acquireProviderPermit(owner);
    }
    if (!permit.acquired) throw new HltbProviderUnavailable(permit.retryAt);
    let cooldown: Date | null = null;
    try {
      const response = await fetch(url, {
        ...init, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        headers: { "User-Agent": USER_AGENT, Referer: `${BASE_URL}/`, Origin: BASE_URL, ...init.headers },
      });
      if (response.status === 404 && url.pathname.startsWith("/api/")) {
        // A site deployment can rotate the public endpoint. Rediscover on the next
        // permitted lookup rather than pinning an obsolete path until restart.
        this.searchPath = null;
        this.session = null;
      }
      if ([401, 403, 429].includes(response.status) || response.status >= 500) {
        if (response.status === 401) { this.session = null; this.searchPath = null; }
        cooldown = retryAt(response.headers.get("retry-after"), response.status === 403 ? 300_000 : 60_000);
        await response.body?.cancel();
        throw new HltbProviderUnavailable(cooldown);
      }
      // Consume while holding the cross-process permit. Neither an oversized body nor a
      // slow stream can retain a lease indefinitely or reach the caller's parser.
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 2 * 1024 * 1024) throw new Error("HLTB response exceeded its size limit");
            chunks.push(value);
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      }
      return new Response([204, 205, 304].includes(response.status) ? null : Buffer.concat(chunks), { status: response.status, headers: response.headers });
    } catch (error) {
      if (error instanceof HltbProviderUnavailable) throw error;
      cooldown = new Date(Date.now() + 60_000);
      throw new HltbProviderUnavailable(cooldown);
    } finally {
      await this.permits.releaseProviderPermit(owner, cooldown);
    }
  }
}

export function retryAt(value: string | null, fallbackMs: number, now = Date.now()): Date {
  const seconds = value !== null && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
  const timestamp = seconds !== null ? now + seconds * 1000 : value ? Date.parse(value) : NaN;
  // Honor a provider's longer cooldown; Date's representable maximum bounds storage.
  return new Date(seconds !== null && !Number.isFinite(seconds) ? 8_640_000_000_000_000 : Number.isFinite(timestamp) ? Math.min(8_640_000_000_000_000, Math.max(now + fallbackMs, timestamp)) : now + fallbackMs);
}
