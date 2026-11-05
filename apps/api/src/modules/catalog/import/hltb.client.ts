import { injectable } from "tsyringe";
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
  private lastRequestAt = 0;

  async findTimes(title: string): Promise<ImportedTimes | null> {
    const wanted = normalizeTitle(title);
    if (!wanted) return null;
    const matches = (await this.search(title, 1)).filter((g) => normalizeTitle(g.title) === wanted);
    return matches.length === 1 ? matches[0].times : null;
  }

  async listPopular(): Promise<HltbPopularityGame[]> {
    const games = new Map<number, HltbPopularityGame>();
    for (let page = 1; page <= MAX_POPULAR_PAGES; page++) {
      const rows = await this.search("", page);
      const before = games.size;
      for (const game of rows) games.set(game.hltbId, game);
      if (rows.length < PAGE_SIZE || games.size === before) break;
    }
    return [...games.values()];
  }

  private async search(title: string, page: number): Promise<HltbPopularityGame[]> {
    // Refresh an expired public session once. Rate limiting fails fast instead of sleeping minutes.
    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await this.getSession();
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
      const res = await this.request(this.searchPath!, { method: "POST", headers, body: JSON.stringify(payload) });
      if ((res.status === 401 || res.status === 403) && attempt === 0) { this.session = null; continue; }
      if (!res.ok) throw new Error(`HLTB search failed: ${res.status}`);
      return parseHltbGames(await res.json());
    }
    throw new Error("HLTB public session could not be refreshed");
  }

  private async getSession(): Promise<HltbSession> {
    if (this.session && Date.now() - this.sessionAt < 15 * 60_000) return this.session;
    const searchPath = await this.discoverSearchPath();
    const res = await this.request(`${searchPath}/init?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HLTB session request failed: ${res.status}`);
    this.session = parseHltbSession(await res.json());
    this.sessionAt = Date.now();
    return this.session;
  }

  private async discoverSearchPath(): Promise<string> {
    if (this.searchPath) return this.searchPath;
    const home = await this.request("/");
    if (!home.ok) throw new Error(`HLTB website request failed: ${home.status}`);
    for (const script of hltbScriptUrls(await home.text())) {
      const res = await this.request(script);
      if (!res.ok) continue;
      const path = hltbApiPath(await res.text());
      if (path) { this.searchPath = path; return path; }
    }
    this.searchPath = "/api/search/site";
    return this.searchPath;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(path, BASE_URL);
    if (url.origin !== BASE_URL) throw new Error("HLTB request must stay on its public website");
    const wait = this.lastRequestAt + 500 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    try {
      return await fetch(url, {
        ...init, redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Referer: `${BASE_URL}/`, Origin: BASE_URL, ...init.headers },
      });
    } catch { throw new Error("HLTB public website request failed or timed out"); }
  }
}
