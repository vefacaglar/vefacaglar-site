import { injectable } from "tsyringe";
import { normalizeTitle, type IHltbClient, type ImportedTimes } from "./import.types";

const BASE_URL = "https://howlongtobeat.com";
// HLTB binds its search token to the client's IP and User-Agent, so the same
// UA must be sent on the init call and on every search call.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

type HltbResult = {
  game_name: string;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
};

/**
 * HowLongToBeat has no public API; this mirrors the site's own search request
 * (`/api/search/site` with a token from `/api/search/site/init`). It can break
 * whenever HLTB changes its frontend.
 */
@injectable()
export class HltbClient implements IHltbClient {
  private token: string | null = null;

  async findTimes(title: string): Promise<ImportedTimes | null> {
    let res = await this.search(title);
    for (let attempt = 0; attempt < 3 && (res.status === 403 || res.status === 429); attempt++) {
      // 403: token expired, fetch a new one. 429: HLTB asks to wait a minute.
      if (res.status === 403) this.token = null;
      else await new Promise((r) => setTimeout(r, 60_000));
      res = await this.search(title);
    }
    if (!res.ok) throw new Error(`HLTB search failed: ${res.status}`);

    const data = (await res.json()) as { data?: HltbResult[] };
    const wanted = normalizeTitle(title);
    // Only accept an exact title match; the first fuzzy hit is often a sequel or DLC.
    const match = (data.data ?? []).find((g) => normalizeTitle(g.game_name) === wanted);
    if (!match) return null;

    return {
      mainHours: toHours(match.comp_main),
      mainExtraHours: toHours(match.comp_plus),
      completionistHours: toHours(match.comp_100),
    };
  }

  private async search(title: string): Promise<Response> {
    const token = await this.getToken();
    return fetch(`${BASE_URL}/api/search/site`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json", "x-auth-token": token },
      body: JSON.stringify({
        searchType: "games",
        searchTerms: title.trim().split(/\s+/),
        searchPage: 1,
        size: 20,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: null, max: null },
            gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
            rangeYear: { min: "", max: "" },
            modifier: "",
          },
          users: { sortCategory: "postcount" },
          lists: { sortCategory: "follows" },
          filter: "",
          sort: 0,
          randomizer: 0,
        },
        useCache: true,
      }),
    });
  }

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    const res = await fetch(`${BASE_URL}/api/search/site/init?t=${Date.now()}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`HLTB token request failed: ${res.status}`);
    const data = (await res.json()) as { token: string };
    this.token = data.token;
    return data.token;
  }

  private headers(): Record<string, string> {
    return { "User-Agent": USER_AGENT, Referer: `${BASE_URL}/`, Origin: BASE_URL };
  }
}

/** HLTB reports seconds; round to one decimal hour. Zero means "no data". */
function toHours(seconds: number): number | null {
  return seconds > 0 ? Math.round(seconds / 360) / 10 : null;
}
