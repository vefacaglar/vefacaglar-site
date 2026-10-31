import { injectable } from "tsyringe";
import {
  normalizeTitle,
  type IIgdbClient,
  type ImportedGame,
  type ImportedGamePage,
  type ImportedLookup,
} from "./import.types";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const GAMES_URL = "https://api.igdb.com/v4/games";
const COVER_URL = "https://images.igdb.com/igdb/image/upload/t_cover_big";
const PAGE_SIZE = 500; // IGDB's maximum per request

const FIELDS = [
  "fields id,name,slug,summary,first_release_date,cover.image_id,game_type.type,",
  "genres.name,genres.slug,themes.name,themes.slug,platforms.name,platforms.slug,",
  "involved_companies.developer,involved_companies.publisher,",
  "involved_companies.company.name,involved_companies.company.slug;",
].join(" ");

// Game types worth a catalog entry. Mods, bundles, packs, episodes, updates and
// ports would only add noise or duplicates. Compared after normalizeTitle().
const ALLOWED_GAME_TYPES = new Set(["maingame", "remake", "remaster", "expandedgame", "standaloneexpansion"]);

type IgdbNamed = { name: string; slug: string };
type IgdbGame = {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  first_release_date?: number;
  cover?: { image_id: string };
  game_type?: { type: string };
  genres?: IgdbNamed[];
  themes?: IgdbNamed[];
  platforms?: IgdbNamed[];
  involved_companies?: { developer: boolean; publisher: boolean; company: IgdbNamed }[];
};

/** IGDB API v4 client, authenticated with Twitch client credentials. */
@injectable()
export class IgdbClient implements IIgdbClient {
  private token: { value: string; expiresAt: number } | null = null;

  async findGame(query: string): Promise<ImportedGame | null> {
    const results = await this.query(
      `search "${query.replace(/"/g, '\\"')}"; ${FIELDS} where version_parent = null; limit 10;`
    );
    if (results.length === 0) return null;

    const wanted = normalizeTitle(query);
    const match = results.find((g) => normalizeTitle(g.name) === wanted) ?? results[0];
    return this.toImportedGame(match);
  }

  async listGames(afterId: number, options: { minRatings?: number } = {}): Promise<ImportedGamePage> {
    // Editions (version_parent) and DLC/expansions (parent_game) belong to a main game.
    const where = [`id > ${afterId}`, "version_parent = null", "parent_game = null"];
    if (options.minRatings) where.push(`total_rating_count >= ${options.minRatings}`);

    const results = await this.query(`${FIELDS} where ${where.join(" & ")}; sort id asc; limit ${PAGE_SIZE};`);
    return {
      lastId: results.length > 0 ? results[results.length - 1].id : null,
      games: results
        .filter((g) => !g.game_type || ALLOWED_GAME_TYPES.has(normalizeTitle(g.game_type.type)))
        .map((g) => this.toImportedGame(g)),
    };
  }

  private async query(body: string): Promise<IgdbGame[]> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(GAMES_URL, { method: "POST", headers: await this.authHeaders(), body });
      // 429 means we went over 4 req/s; back off briefly and retry.
      if (res.status === 429 && attempt < 5) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`IGDB request failed: ${res.status} ${await res.text()}`);
      return (await res.json()) as IgdbGame[];
    }
  }

  private toImportedGame(game: IgdbGame): ImportedGame {
    const companies = game.involved_companies ?? [];
    const lookup = (items?: IgdbNamed[]): ImportedLookup[] =>
      (items ?? []).map((i) => ({ name: i.name, slug: i.slug }));

    return {
      title: game.name,
      slug: game.slug,
      description: game.summary ?? null,
      coverImageUrl: game.cover ? `${COVER_URL}/${game.cover.image_id}.jpg` : null,
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      developers: lookup(companies.filter((c) => c.developer).map((c) => c.company)),
      publishers: lookup(companies.filter((c) => c.publisher).map((c) => c.company)),
      genres: lookup(game.genres),
      platforms: lookup(game.platforms),
      themes: lookup(game.themes),
    };
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set.");
    }

    if (!this.token || this.token.expiresAt <= Date.now()) {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      });
      const res = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" });
      if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
      const data = (await res.json()) as { access_token: string; expires_in: number };
      // Refresh a minute early so a long run never sends an expired token.
      this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    }

    return {
      "Client-ID": clientId,
      Authorization: `Bearer ${this.token.value}`,
      Accept: "application/json",
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
