import { inject, injectable } from "tsyringe";
import { IGDB_CLIENT } from "../import/import.tokens";
import type { IgdbClient } from "../import/igdb.client";
import { parseBackloggd, parseIfdb, parseVndb, parseCompletionMappings, backloggdAllowed } from "./completion-sources.parsers";
import type { CompletionIdentity } from "./completion-sources.types";

export class CompletionSourceError extends Error {
  constructor(readonly code: string, readonly retryAt = new Date(Date.now() + 60 * 60_000)) { super(code); }
}
const USER_AGENT = "VefaLibrary/1.0 (+https://vefacaglar.com; public game completion statistics)";

@injectable()
export class CompletionSourcesClient {
  private readonly lastRequestAt = new Map<string, number>();
  constructor(@inject(IGDB_CLIENT) private readonly igdb: Pick<IgdbClient, "listCompletionIdentities">) {}

  async identities(deadline: number) {
    const query = "SELECT ?item ?igdb ?ifdb ?vndb WHERE { ?item wdt:P5794 ?igdb. OPTIONAL { ?item wdt:P6748 ?ifdb. } OPTIONAL { ?item wdt:P3180 ?vndb. } FILTER(BOUND(?ifdb) || BOUND(?vndb)) }";
    const url = new URL("https://query.wikidata.org/sparql");
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");
    return parseCompletionMappings(await this.json(url.href, deadline, 40_000, 4 * 1024 * 1024));
  }

  async canonical(igdbIds: number[], deadline: number) {
    if (Date.now() >= deadline) throw new CompletionSourceError("completion_source_budget_exhausted");
    return this.igdb.listCompletionIdentities(igdbIds, AbortSignal.timeout(Math.max(1, deadline - Date.now())));
  }

  async robots(deadline: number): Promise<string> {
    return this.text("https://backloggd.com/robots.txt", deadline, 10_000, 64 * 1024);
  }

  async backloggd(identity: CompletionIdentity, robots: string, deadline: number) {
    if (!backloggdAllowed(robots, identity.slug)) throw new CompletionSourceError("backloggd_robots_disallow", new Date(Date.now() + 7 * 86400_000));
    const html = await this.text(`https://backloggd.com/games/${identity.slug}/`, deadline, 10_000, 2 * 1024 * 1024);
    try { return parseBackloggd(html, identity, new Date()); }
    catch (error) {
      if (error instanceof Error && error.message === "backloggd_challenge") {
        throw new CompletionSourceError("backloggd_challenge", new Date(Date.now() + 7 * 86400_000));
      }
      throw error;
    }
  }

  async ifdb(identity: CompletionIdentity, deadline: number) {
    if (!/^[a-z0-9]{16}$/.test(identity.ifdbId ?? "")) throw new CompletionSourceError("ifdb_invalid_identity");
    const url = new URL("https://ifdb.org/search");
    url.searchParams.set("json", "");
    url.searchParams.set("game", "");
    // IFDB only includes its optional time field when the documented playtime
    // modifier is present. tuid is an exact lookup; titles are never matched.
    url.searchParams.set("searchfor", `tuid:${identity.ifdbId} playtime:0-60000`);
    return parseIfdb(await this.json(url.href, deadline), identity, new Date());
  }

  async vndb(identities: CompletionIdentity[], deadline: number) {
    if (!identities.length || identities.length > 100 || identities.some((identity) => !/^v[1-9][0-9]*$/.test(identity.vndbId ?? ""))) {
      throw new CompletionSourceError("vndb_invalid_identity_batch");
    }
    const body = JSON.stringify({ filters: ["or", ...identities.map((identity) => ["id", "=", identity.vndbId])],
      fields: "id,length_minutes,length_votes,extlinks.name,extlinks.id", results: 100 });
    return parseVndb(await this.json("https://api.vndb.org/kana/vn", deadline, 10_000, 512 * 1024, body), identities, new Date());
  }

  private async json(url: string, deadline: number, timeout = 10_000, maxBytes = 512 * 1024, body?: string): Promise<unknown> {
    const text = await this.request(url, deadline, timeout, maxBytes, "json", body);
    try { return JSON.parse(text); }
    catch { throw new CompletionSourceError("completion_source_invalid_json"); }
  }
  private text(url: string, deadline: number, timeout: number, maxBytes: number) {
    return this.request(url, deadline, timeout, maxBytes, "text");
  }
  private async request(url: string, deadline: number, timeout: number, maxBytes: number, kind: "json" | "text", body?: string) {
    const origin = new URL(url).origin;
    if (!["https://backloggd.com", "https://ifdb.org", "https://api.vndb.org", "https://query.wikidata.org"].includes(origin)) {
      throw new CompletionSourceError("completion_source_origin_not_allowed");
    }
    const spacing = origin === "https://backloggd.com" ? 2000 : 1000;
    const wait = (this.lastRequestAt.get(origin) ?? 0) + spacing - Date.now();
    if (Date.now() + Math.max(0, wait) >= deadline) throw new CompletionSourceError("completion_source_budget_exhausted");
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt.set(origin, Date.now());
    let response: Response;
    try {
      response = await fetch(url, { method: body ? "POST" : "GET", body, redirect: "manual", headers: {
        "User-Agent": USER_AGENT, Accept: kind === "json" ? "application/json, application/sparql-results+json" : "text/html,text/plain",
        ...(body ? { "Content-Type": "application/json" } : {}),
      }, signal: AbortSignal.timeout(Math.max(1, Math.min(timeout, deadline - Date.now()))) });
    } catch { throw new CompletionSourceError("completion_source_request_failed"); }
    if (!response.ok) {
      const retryHeader = response.headers.get("retry-after");
      const seconds = retryHeader === null ? NaN : Number(retryHeader);
      const retry = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(retryHeader ?? "");
      await response.body?.cancel();
      const cooldown = response.status === 403 ? 7 * 86400_000 : 60 * 60_000;
      throw new CompletionSourceError(`completion_source_http_${response.status}`, new Date(Math.max(Date.now() + cooldown, Number.isFinite(retry) ? retry : 0)));
    }
    if (!response.body || Number(response.headers.get("content-length") ?? 0) > maxBytes ||
      (kind === "json" && !response.headers.get("content-type")?.includes("json"))) {
      await response.body?.cancel();
      throw new CompletionSourceError("completion_source_body_invalid");
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > maxBytes) throw new CompletionSourceError("completion_source_body_too_large");
        parts.push(part.value);
      }
      return Buffer.concat(parts).toString("utf8");
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
