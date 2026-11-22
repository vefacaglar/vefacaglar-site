import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { RefreshMoviePopularityHandler } from "./popularity.handler";
import { MovieAudienceService } from "./audience.service";
import { MovieAudienceClient, parseNetflixAudience, verifyNetflixNativeTitle } from "./audience.client";
import { audienceRanking, audienceSummary, dateAfter, matchNetflixCandidate } from "./audience-ranking";
import { MovieAudienceError, type AudienceItem, type AudienceProvider, type AudienceSnapshot, type IMovieAudienceClient, type IMovieAudienceRepository } from "./audience.types";

const now = new Date("2026-11-22T12:00:00Z");
const item = (externalId: string, rank = 1, wikidataId?: string): AudienceItem => ({ externalId, rank, wikidataId, title: `Film ${externalId}`, value: 1000 / rank });
function snapshot(provider: AudienceProvider, items: AudienceItem[]): AudienceSnapshot {
  const sourceDate = provider === "tmdb" ? "2026-11-22" : provider === "netflix" ? "2026-11-15" : "2026-11-21";
  return { provider, sourceDate, windowStart: sourceDate, expiresAt: dateAfter(sourceDate, provider === "netflix" ? 21 : provider === "wikipedia" ? 8 : 3),
    sourceUrl: `https://example.test/${provider}`, items };
}
let repo: Record<keyof IMovieAudienceRepository, any>;
let client: Record<keyof IMovieAudienceClient, any>;
let wiki: { refresh: ReturnType<typeof vi.fn> };
let accepted: Map<AudienceProvider, AudienceSnapshot>;
const run = () => new RefreshMoviePopularityHandler(new MovieAudienceService(repo, client, wiki as any)).handle();

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  accepted = new Map();
  repo = { sources: vi.fn(async () => ["tmdb", "netflix", "wikipedia"].map((provider) => ({ provider, snapshot: accepted.get(provider as AudienceProvider) ?? null, cooldownUntil: null, errorCode: null }))),
    identities: vi.fn().mockResolvedValue([]), saveIdentities: vi.fn(), accept: vi.fn(async (source: AudienceSnapshot) => { accepted.set(source.provider, source); }),
    failure: vi.fn(), wikidataCooldown: vi.fn().mockResolvedValue(null), deferWikidata: vi.fn(), wikipedia: vi.fn().mockResolvedValue(snapshot("wikipedia", [item("Q2", 1, "Q2")])),
    publish: vi.fn().mockResolvedValue({ status: "published", observedMovieCount: 3 }) };
  client = { tmdb: vi.fn().mockResolvedValue(snapshot("tmdb", [item("1"), item("2", 2)])), netflix: vi.fn().mockResolvedValue(snapshot("netflix", [item("netflix-3")])),
    tmdbIdentities: vi.fn().mockResolvedValue(new Map([["1", "Q1"], ["2", "Q2"]])), netflixIdentities: vi.fn().mockResolvedValue(new Map([["netflix-3", "Q3"]])) };
  wiki = { refresh: vi.fn().mockResolvedValue({ status: "unchanged" }) };
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("current multi-source movie popularity handler", () => {
  it("lets independent current evidence change the head without an age or taste boost", async () => {
    expect((await run()).status).toBe("published");
    const [sources, scores] = repo.publish.mock.calls[0];
    expect(sources).toHaveLength(3);
    expect(scores).toEqual([{ wikidataId: "Q2", score: 672727, sourceMask: 5 }, { wikidataId: "Q1", score: 630000, sourceMask: 1 }, { wikidataId: "Q3", score: 270000, sourceMask: 2 }]);
    expect(accepted.get("netflix")?.sourceDate).toBe("2026-11-15");
  });
  it("keeps fixed weights when a title is present in only one feed", async () => {
    repo.wikipedia.mockResolvedValue(snapshot("wikipedia", [item("Q4", 1, "Q4")]));
    await run();
    const scores = repo.publish.mock.calls[0][1];
    expect(scores.find((row: any) => row.wikidataId === "Q3").score).toBe(270000);
    expect(scores.find((row: any) => row.wikidataId === "Q4").score).toBe(100000);
  });
  it("retains rank differences under a lopsided audience distribution", async () => {
    client.tmdb.mockResolvedValue(snapshot("tmdb", [{ ...item("1"), value: 1e12 }, { ...item("2", 2), value: 1 }]));
    client.netflixIdentities.mockResolvedValue(new Map([["netflix-3", "Q2"]]));
    await run();
    const scores = repo.publish.mock.calls[0][1];
    expect(scores[0]).toMatchObject({ wikidataId: "Q2", score: 942727, sourceMask: 7 });
    expect(scores[1].score).toBe(630000);
  });
  it("retains accepted evidence through an upstream or mapping outage", async () => {
    const previous = { ...snapshot("tmdb", [item("1", 1, "Q1")]), sourceDate: "2026-11-21" };
    accepted.set("tmdb", previous);
    client.tmdbIdentities.mockRejectedValue(new MovieAudienceError("wdqs_unavailable", new Date("2026-11-23T00:00:00Z"), true));
    await run();
    expect(repo.publish.mock.calls[0][0]).toContainEqual(previous);
    expect(repo.deferWikidata).toHaveBeenCalled();
    expect(repo.failure).toHaveBeenCalledWith("tmdb", "wdqs_unavailable", expect.any(Date));
  });
  it("drops expired evidence without promoting a missing signal to a full score", async () => {
    accepted.set("tmdb", { ...snapshot("tmdb", [item("1", 1, "Q1")]), sourceDate: "2026-11-18", expiresAt: "2026-11-21T00:00:00Z" });
    client.tmdb.mockRejectedValue(new MovieAudienceError("tmdb_unavailable"));
    await run();
    expect(repo.publish.mock.calls[0][0].map((source: AudienceSnapshot) => source.provider)).toEqual(["netflix", "wikipedia"]);
    expect(repo.publish.mock.calls[0][1].find((row: any) => row.wikidataId === "Q3").score).toBe(270000);
  });
  it("keeps the persisted chart when only Wikipedia remains available", async () => {
    client.tmdb.mockRejectedValue(new Error("offline")); client.netflix.mockRejectedValue(new Error("offline"));
    await expect(run()).rejects.toThrow("no_current_audience_evidence");
    expect(repo.publish).not.toHaveBeenCalled();
    expect(audienceRanking([audienceSummary(snapshot("wikipedia", [item("Q2", 1, "Q2")]))], true, now)).toMatchObject({ mode: "recognition", isFresh: false });
  });
  it("does not replace the last Netflix week with a partial provider response", async () => {
    const previous = snapshot("netflix", [item("netflix-3", 1, "Q3")]);
    accepted.set("netflix", previous);
    client.netflix.mockImplementation(() => parseNetflixAudience("week\tcategory\tweekly_rank\tshow_title\truntime\tweekly_views\n2026-11-15\tFilms (English)\t1\tFilm\t2\t123", now));
    await run();
    expect(repo.publish.mock.calls[0][0]).toContainEqual(previous);
    expect(repo.failure).toHaveBeenCalledWith("netflix", "netflix_incomplete_film_week", expect.any(Date));
  });
  it("leaves ambiguous provider identities unscored without renumbering the other ranks", async () => {
    client.tmdbIdentities.mockResolvedValue(new Map([["1", null], ["2", "Q2"]]));
    await run();
    expect(accepted.get("tmdb")?.items[0].wikidataId).toBeUndefined();
    expect(repo.publish.mock.calls[0][1].find((row: any) => row.wikidataId === "Q2").score).toBe(672727);
    expect(repo.publish.mock.calls[0][1].some((row: any) => row.wikidataId === "Q1")).toBe(false);
  });
  it("respects source cooldowns and retained snapshots without another upstream request", async () => {
    const previous = { ...snapshot("tmdb", [item("1", 1, "Q1")]), sourceDate: "2026-11-21" };
    accepted.set("tmdb", previous);
    const sources = repo.sources.getMockImplementation()!;
    repo.sources.mockImplementation(async () => (await sources()).map((source: any) => source.provider === "tmdb"
      ? { ...source, cooldownUntil: new Date("2026-11-23T00:00:00Z") } : source));
    await run();
    expect(client.tmdb).not.toHaveBeenCalled();
    expect(repo.publish.mock.calls[0][0]).toContainEqual(previous);
  });
  it("reads both Netflix film lists by weekly views and excludes television", async () => {
    const header = "week\tcategory\tweekly_rank\tshow_title\truntime\tweekly_views";
    const rows = ["Films (English)", "Films (Non-English)"].flatMap((category) => Array.from({ length: 10 }, (_, index) =>
      ["2026-11-15", category, index + 1, `${category} ${index}`, "2", (20 - index) * 1000].join("\t")));
    rows.push(["2026-11-15", "TV (English)", 1, "A show", "8", "999999999"].join("\t"));
    client.netflix.mockImplementation(() => parseNetflixAudience([header, ...rows].join("\n"), now));
    client.netflixIdentities.mockImplementation(async (items: AudienceItem[]) => new Map(items.map((item, index) => [item.externalId, `Q${index + 100}`])));
    await run();
    const netflix = accepted.get("netflix")!;
    expect(netflix.items).toHaveLength(20);
    expect(netflix.items.every((item) => item.title !== "A show")).toBe(true);
    expect(netflix.items.filter((item) => item.rank === 1)).toHaveLength(2);
    expect(netflix.windowStart).toBe("2026-11-09");
  });
  it("preserves the accepted TMDB evidence after a truncated gzip export", async () => {
    const previous = { ...snapshot("tmdb", [item("1", 1, "Q1")]), sourceDate: "2026-11-21" };
    accepted.set("tmdb", previous);
    const rows = Array.from({ length: 5000 }, (_, index) => ({ adult: false, video: false, id: index + 1, original_title: "Film", popularity: index + 1 }));
    const compressed = gzipSync(rows.map((row) => JSON.stringify(row)).join("\n"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(compressed.subarray(0, compressed.length - 6))));
    client.tmdb.mockImplementation(() => new MovieAudienceClient().tmdb(now));
    await run();
    expect(repo.publish.mock.calls[0][0]).toContainEqual(previous);
    expect(repo.failure).toHaveBeenCalledWith("tmdb", "tmdb_incomplete_export", expect.any(Date));
  });
  it("uses durable verified mappings and retries expired misses", async () => {
    repo.identities.mockImplementation(async (provider: string) => provider === "tmdb" ? [
      { provider, externalId: "1", wikidataId: "Q1", checkedAt: new Date("2026-10-01T00:00:00Z") },
      { provider, externalId: "2", wikidataId: null, checkedAt: new Date("2026-11-20T00:00:00Z") },
    ] : []);
    client.tmdbIdentities.mockResolvedValue(new Map([["2", "Q2"]]));
    await run();
    expect(client.tmdbIdentities).toHaveBeenCalledWith(["2"], expect.any(Function));
    expect(repo.saveIdentities).toHaveBeenCalledWith([expect.objectContaining({ provider: "tmdb", externalId: "2", wikidataId: "Q2" })]);
  });
  it("requires all published source windows to be fresh before reusing index scores", () => {
    const sources = [audienceSummary(snapshot("tmdb", [item("1", 1, "Q1")])), audienceSummary(snapshot("netflix", [item("3", 1, "Q3")]))];
    expect(audienceRanking(sources, true, now).mode).toBe("combined_popularity");
    expect(audienceRanking(sources, true, new Date("2026-11-26T00:00:00Z"))).toMatchObject({ mode: "recognition", isFresh: false });
  });
  it("streams today's actual nullable-flag export shape and excludes adult/video/unknown flags", async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ adult: false, video: false, id: i + 1000, original_title: `Film ${i}`, popularity: 5000 - i }));
    const extra = [{ adult: true, video: false, id: 1, original_title: "Adult", popularity: 1e9 },
      { adult: false, video: true, id: 2, original_title: "Video", popularity: 1e9 },
      { adult: false, video: null, id: 3, original_title: "Unknown", popularity: 1e9 }];
    const compressed = gzipSync([...rows, ...extra].map((row) => JSON.stringify(row)).join("\n"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(compressed)));
    client.tmdb.mockImplementation(() => new MovieAudienceClient().tmdb(now));
    client.tmdbIdentities.mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, `Q${id}`])));
    await run();
    expect(accepted.get("tmdb")?.items).toHaveLength(500);
    expect(accepted.get("tmdb")?.items.some((row) => ["1", "2", "3"].includes(row.externalId))).toBe(false);
  });
});

describe("exact Netflix identity evidence", () => {
  const film = { ...item("film"), title: "Same Name", runtimeMinutes: 120 };
  it("rejects same-name remakes and incompatible runtimes", () => {
    const candidates = [{ wikidataId: "Q1", title: "Same Name", runtimeMinutes: 120, netflixId: null },
      { wikidataId: "Q2", title: "Same Name", runtimeMinutes: 122, netflixId: null }];
    expect(matchNetflixCandidate(film, candidates, new Set())).toBeNull();
    expect(matchNetflixCandidate(film, [{ ...candidates[0], runtimeMinutes: 90 }], new Set())).toBeNull();
  });
  it("requires the exact official native URL and title when runtime is unavailable", () => {
    const candidate = { wikidataId: "Q1", title: "Same Name", runtimeMinutes: null, netflixId: "12345678" };
    expect(matchNetflixCandidate(film, [candidate], new Set())).toBeNull();
    const html = '<meta property="og:url" content="https://www.netflix.com/title/12345678"><meta property="og:title" content="Watch Same Name | Netflix Official Site">';
    expect(verifyNetflixNativeTitle(html, "12345678", "Same Name")).toBe(true);
    expect(verifyNetflixNativeTitle(html, "87654321", "Same Name")).toBe(false);
    expect(verifyNetflixNativeTitle(html, "12345678", "Another Film")).toBe(false);
    expect(matchNetflixCandidate(film, [candidate], new Set(["12345678"]))).toBe("Q1");
  });
});
