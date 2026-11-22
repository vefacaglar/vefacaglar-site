import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshPopularityHandler } from "./popularity.handler";
import { computePopularityScores, gameFormatAffinity, POPULARITY_RANKING_VERSION, type PopularityInput, type GameFormatEvidence } from "./popularity-score";
import { GameAudienceService, type GameAudienceResult } from "./game-audience.service";
import { GameAudienceSourceError, type GameWikipediaAudienceClient } from "./wikipedia-audience.client";
import { gameAudienceUrl, parseGameAudience, wikipediaGameArticle } from "./wikipedia-audience";
import { parseRankingMetadata } from "../import/igdb-ranking-metadata";
import { popularityCandidateIds } from "./popularity-candidates";
import type { OwnerRankingService } from "./owner-ranking.service";
import type { PopularityDiscoveryService } from "./popularity-discovery.service";
import type { IGamesRepository } from "../games.repository.interface";
import type { IIgdbClient } from "../import/import.types";
import type { IEventBus } from "../../../shared/events/event-bus";

const date = (value: string) => new Date(value);
const observed = date("2026-11-01T00:00:00Z");
const primitive = (igdbId: number, popularityType: number, value: number, calculatedAt = observed) => ({ igdbId, popularityType, value, calculatedAt });
const evidence = (patch: Partial<GameFormatEvidence> = {}): GameFormatEvidence => ({ gameModeIds: null, keywordNames: [], hasStoryline: false, ...patch });
const audience = (currentViews: number, baselineViews: number) => ({ sourceDate: "2026-11-01", currentViews, baselineViews });

// These fixtures deliberately describe formats and measurements without game names, genres or release dates.
describe("current campaign interest", () => {
  it("keeps optional online modes compatible with campaign evidence", () => {
    expect(gameFormatAffinity(evidence({ gameModeIds: [1, 2, 3], keywordNames: ["campaign"] }))).toBe(1);
    expect(gameFormatAffinity(evidence({ gameModeIds: [1], hasStoryline: false }))).toBe(1);
    expect(gameFormatAffinity()).toBe(0.85);
    expect(gameFormatAffinity(evidence({ gameModeIds: [2, 3] }))).toBe(0.85);
  });

  it("uses measured ongoing formats with a positive floor and keeps hybrids", () => {
    expect(gameFormatAffinity(evidence({ gameModeIds: [1, 6] }))).toBe(0.35);
    expect(gameFormatAffinity(evidence({ gameModeIds: [1, 6], keywordNames: ["campaign"] }))).toBe(0.60);
    expect(gameFormatAffinity(evidence({ gameModeIds: [1, 2], keywordNames: ["user generated content", "game creator"] }))).toBe(0.35);
  });

  it("does not treat incidental modding, sandbox or one creation tag as an ongoing format", () => {
    for (const keywords of [["sandbox", "mod support"], ["user generated content"], ["game creator"]]) {
      expect(gameFormatAffinity(evidence({ gameModeIds: [1, 2], keywordNames: keywords, hasStoryline: true }))).toBe(1);
    }
  });

  it("does not create interest from story, format, historical totals or audience alone", () => {
    const scores = computePopularityScores([
      { id: "unknown", signals: {}, format: evidence({ hasStoryline: true }), audience: audience(1_000_000, 1) },
      { id: "history", signals: { lifetimePlayed: 1e9, ratingCount: 1e9 } } as unknown as PopularityInput,
      { id: "zero", signals: { visits: 0, playing: 0 }, audience: audience(1_000_000, 1) },
    ]);
    expect(scores.get("unknown")).toBeNull();
    expect(scores.get("history")).toBeNull();
    expect(scores.get("zero")).toBe(0);
  });

  it("bounds a lone Steam measurement and retains weak Visits-only coverage", () => {
    const scores = computePopularityScores([
      { id: "steam", signals: { steam24hPeak: 100 }, format: evidence({ gameModeIds: [1] }) },
      { id: "visits", signals: { visits: 100 }, format: evidence({ gameModeIds: [1] }) },
    ]);
    expect(scores.get("steam")).toBeCloseTo(0.35 * 0.15 / 1.05);
    expect(scores.get("visits")).toBeCloseTo(0.35 * 0.45 * 0.50 / 1.05);
  });

  it("keeps the gaming base on the same scale with and without a valid audience window", () => {
    const input = { id: "a", signals: { visits: 10, playing: 5 }, format: evidence({ gameModeIds: [1] }) };
    const without = computePopularityScores([input]).get("a")!;
    const measuredZero = computePopularityScores([{ ...input, audience: audience(0, 0) }]).get("a")!;
    const measuredCurrent = computePopularityScores([{ ...input, audience: audience(10_000, 40_000) }]).get("a")!;
    expect(measuredZero).toBeCloseTo(without);
    expect(measuredCurrent).toBeGreaterThan(without);
  });

  it("lets a genuine resurgence beat a stable peer and keeps a hot plateau competitive", () => {
    const signals = { visits: 100, playing: 20, played: 10 };
    const format = evidence({ gameModeIds: [1] });
    const scores = computePopularityScores([
      { id: "resurgence", signals, format, audience: audience(100_000, 80_000) },
      { id: "steady", signals, format, audience: audience(100_000, 400_000) },
      { id: "plateau", signals, format, audience: audience(100_000, 800_000) },
      { id: "small-noise", signals: { visits: 1, playing: 1 }, format, audience: audience(30, 4) },
    ]);
    expect(scores.get("resurgence")!).toBeGreaterThan(scores.get("steady")!);
    expect(scores.get("plateau")).toBeCloseTo(scores.get("steady")!);
    expect(scores.get("plateau")!).toBeGreaterThan(scores.get("small-noise")!);
  });

  it("requires gaming corroboration for incremental attention and preserves bounded solo preference", () => {
    const inputs: PopularityInput[] = [
      { id: "gaming", signals: { visits: 100, playing: 20 }, audience: audience(100_000, 1000) },
      { id: "only-visits", signals: { visits: 100 }, audience: audience(100_000, 1000) },
    ];
    const scores = computePopularityScores(inputs);
    expect(scores.get("gaming")!).toBeGreaterThan(scores.get("only-visits")!);
    const withSolo = computePopularityScores(inputs.map((input) => ({ ...input, singlePlayer: true })));
    expect(withSolo.get("gaming")! / scores.get("gaming")!).toBeCloseTo(1.05);
    for (const score of withSolo.values()) expect(score!).toBeLessThanOrEqual(1);
  });

  it("keeps format effects finite so strong measured resurgence can overcome affinity", () => {
    const scores = computePopularityScores([
      { id: "surging-ongoing", signals: { visits: 1000, playing: 1000 }, format: evidence({ gameModeIds: [2, 6] }), audience: audience(1_000_000, 1000) },
      { id: "quiet-campaign", signals: { visits: 1, playing: 1 }, format: evidence({ gameModeIds: [1] }), audience: audience(500, 2000) },
    ]);
    expect(scores.get("surging-ongoing")!).toBeGreaterThan(scores.get("quiet-campaign")!);
  });

  it("ignores invalid values while preserving observed zero and unknown distinctions", () => {
    const scores = computePopularityScores([
      { id: "invalid", signals: { visits: NaN, playing: Infinity, played: -1 } },
      { id: "zero", signals: { visits: 0 } },
      { id: "missing", signals: {} },
    ]);
    expect(scores.get("invalid")).toBeNull();
    expect(scores.get("zero")).toBe(0);
    expect(scores.get("missing")).toBeNull();
  });
});

describe("verified game source windows", () => {
  it("accepts official mobile Wikipedia links and rejects unrelated origins and namespaces", () => {
    expect(wikipediaGameArticle("https://en.m.wikipedia.org/wiki/Example_Game#section")).toBe("Example_Game");
    expect(wikipediaGameArticle("https://evil.example/wiki/Example")).toBeNull();
    expect(wikipediaGameArticle("https://en.wikipedia.org/wiki/User:Example")).toBeNull();
    expect(gameAudienceUrl("Example_Game", "2026-11-21").href).toContain("/all-access/user/Example_Game/daily/2026101800/2026112100");
  });

  it("rejects missing days, duplicate days, nonhuman data and mismatched article identities", () => {
    const items = Array.from({ length: 35 }, (_, index) => ({ project: "en.wikipedia", access: "all-access", agent: "user", granularity: "daily",
      article: "Example_Game", timestamp: `${new Date(Date.UTC(2026, 9, 18 + index)).toISOString().slice(0, 10).replace(/-/g, "")}00`, views: 10 }));
    expect(parseGameAudience({ items }, "Example_Game", "2026-11-21")).toEqual({ sourceDate: "2026-11-21", currentViews: 70, baselineViews: 280 });
    expect(() => parseGameAudience({ items: items.slice(1) }, "Example_Game", "2026-11-21")).toThrow();
    for (const patch of [{ timestamp: items[1].timestamp }, { agent: "all-agents" }, { article: "Other" }, { views: -1 }]) {
      expect(() => parseGameAudience({ items: [{ ...items[0], ...patch }, ...items.slice(1)] }, "Example_Game", "2026-11-21")).toThrow();
    }
  });

  it("leaves omitted metadata unknown and rejects unsolicited or duplicate identities", () => {
    expect(parseRankingMetadata([{ id: 1 }], [1, 2])).toEqual([{ igdbId: 1, gameModeIds: null, keywordNames: [], hasStoryline: false, wikipediaArticle: null }]);
    expect(() => parseRankingMetadata([{ id: 3 }], [1])).toThrow();
    expect(() => parseRankingMetadata([{ id: 1 }, { id: 1 }], [1, 2])).toThrow();
  });

  it("selects a deterministic bounded cohort across all current sources", () => {
    const values = [primitive(5, 5, 100), primitive(3, 3, 100), primitive(4, 4, 100), primitive(1, 1, 100), primitive(2, 1, 100)];
    expect(popularityCandidateIds(values)).toEqual([1, 3, 4, 5, 2]);
    expect(popularityCandidateIds([...values].reverse())).toEqual(popularityCandidateIds(values));
  });
});

describe("RefreshPopularityHandler", () => {
  let repo: Record<keyof IGamesRepository, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let events: Record<keyof IEventBus, any>;
  let modes: { backfillGameModes: ReturnType<typeof vi.fn> };
  let discovery: { discover: ReturnType<typeof vi.fn> };
  let audienceService: { prepare: ReturnType<typeof vi.fn> };
  let wikipedia: { fetch: ReturnType<typeof vi.fn> };
  let handler: RefreshPopularityHandler;

  const createHandler = (realAudience = false) => new RefreshPopularityHandler(repo as unknown as IGamesRepository, igdb as unknown as IIgdbClient,
    events as unknown as IEventBus, modes as unknown as OwnerRankingService, discovery as unknown as PopularityDiscoveryService,
    realAudience ? new GameAudienceService(repo as unknown as IGamesRepository, igdb as unknown as IIgdbClient, wikipedia as unknown as GameWikipediaAudienceClient)
      : audienceService as unknown as GameAudienceService);
  const write = () => repo.writePopularity.mock.lastCall[0];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date("2026-11-02T00:00:00Z"));
    repo = { listPopularitySources: vi.fn().mockResolvedValue([
      { id: "g-a", igdbId: 1, popularityScore: null, gameModeIds: null },
      { id: "g-b", igdbId: 2, popularityScore: 0.5, gameModeIds: null },
      { id: "g-c", igdbId: 3, popularityScore: null, gameModeIds: null },
    ]), writePopularity: vi.fn(), findWikipediaInterest: vi.fn().mockResolvedValue([]), writeWikipediaInterest: vi.fn(),
      getWikipediaInterestCooldown: vi.fn().mockResolvedValue(null), setWikipediaInterestCooldown: vi.fn() } as unknown as Record<keyof IGamesRepository, any>;
    igdb = { listPopularity: vi.fn().mockResolvedValue([primitive(999, 1, 1000), primitive(1, 1, 1000), primitive(2, 1, 10),
      primitive(2, 1, 99_999, date("2026-10-01T00:00:00Z")), primitive(1, 3, 100), primitive(2, 3, 25), primitive(3, 8, 1e9)]),
      listRankingMetadata: vi.fn().mockResolvedValue([{ igdbId: 1, ...evidence({ gameModeIds: [1] }), wikipediaArticle: "Example_Game" }]),
    } as unknown as Record<keyof IIgdbClient, any>;
    events = { publish: vi.fn(), subscribe: vi.fn() };
    modes = { backfillGameModes: vi.fn().mockResolvedValue({ checkedCount: 0, status: "complete" }) };
    discovery = { discover: vi.fn().mockResolvedValue(0) };
    audienceService = { prepare: vi.fn().mockResolvedValue({ metadata: new Map(), audience: new Map(), requests: 0, candidateCount: 2, status: "unavailable" } satisfies GameAudienceResult) };
    wikipedia = { fetch: vi.fn().mockResolvedValue(audience(10_000, 40_000)) };
    handler = createHandler();
  });
  afterEach(() => vi.useRealTimers());

  it("fetches current sources globally, deduplicates latest measurements and publishes the versioned score", async () => {
    const result = await handler.handle();
    expect(igdb.listPopularity).toHaveBeenCalledWith([1, 3, 4, 5]);
    expect(write().rankingVersion).toBe(POPULARITY_RANKING_VERSION);
    expect(write().signals).toHaveLength(4);
    expect(write().signals.find((row: any) => row.gameId === "g-b" && row.popularityType === 1).value).toBe(10);
    expect(write().scores[0].score).toBeCloseTo(0.35 * 0.65 * 0.85 / 1.05);
    expect(result).toMatchObject({ rankingVersion: POPULARITY_RANKING_VERSION, gameCount: 3, scoredCount: 2, audienceStatus: "unavailable" });
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ gameIds: ["g-a", "g-b", "g-c"] }), { throwOnError: undefined });
  });

  it("keeps old scores if global source pagination or metadata fails", async () => {
    igdb.listPopularity.mockRejectedValueOnce(new Error("provider failed"));
    await expect(handler.handle()).rejects.toThrow("provider failed");
    expect(repo.writePopularity).not.toHaveBeenCalled();
    audienceService.prepare.mockRejectedValueOnce(new Error("metadata failed"));
    await expect(handler.handle()).rejects.toThrow("metadata failed");
    expect(repo.writePopularity).not.toHaveBeenCalled();
  });

  it("excludes stale, future and undated rows and fails if no current source remains", async () => {
    igdb.listPopularity.mockResolvedValue([primitive(1, 1, 100, date("2026-10-01T00:00:00Z")),
      { ...primitive(2, 3, 100), calculatedAt: null }, primitive(3, 5, 100, date("2026-11-03T00:00:00Z"))]);
    await expect(handler.handle()).rejects.toThrow("existing scores were kept");
    expect(discovery.discover).not.toHaveBeenCalled();
    expect(repo.writePopularity).not.toHaveBeenCalled();
  });

  it("stores the oldest contributing provider date, including cached human observations", async () => {
    audienceService.prepare.mockResolvedValue({ metadata: new Map(), audience: new Map([[1, { ...audience(10_000, 40_000), sourceDate: "2026-10-31" }]]), requests: 0, candidateCount: 2, status: "partial" });
    await handler.handle();
    expect(write().sourceDates).toEqual([{ id: "g-a", calculatedAt: date("2026-10-31T00:00:00Z") }, { id: "g-b", calculatedAt: observed }, { id: "g-c", calculatedAt: null }]);
  });

  it("uses the complete provider population for peaks, including games outside the catalog", async () => {
    igdb.listPopularity.mockResolvedValue([primitive(999, 1, 100_000), primitive(1, 1, 10), primitive(1, 3, 1)]);
    await handler.handle();
    expect(write().scores[0].score).toBeCloseTo(0.35 * (0.45 * 0.01 + 0.20) * 0.85 / 1.05);
  });

  it("repairs strict search publication on a retry even when persisted scores are unchanged", async () => {
    events.publish.mockRejectedValueOnce(new Error("search unavailable"));
    await expect(handler.handle({ requireSearchSync: true })).rejects.toThrow("search unavailable");
    const sources = await repo.listPopularitySources();
    for (const source of sources) source.popularityScore = write().scores.find((row: any) => row.id === source.id).score;
    await handler.handle({ requireSearchSync: true });
    expect(events.publish).toHaveBeenLastCalledWith(expect.objectContaining({ gameIds: ["g-a", "g-b", "g-c"], requireSearchSync: true }), { throwOnError: true });
  });

  it("can discover an initially empty catalog and scores new rows in the same run", async () => {
    repo.listPopularitySources.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "new", igdbId: 1, gameModeIds: [1], popularityScore: null }]);
    discovery.discover.mockResolvedValue(1);
    const result = await handler.handle();
    expect(result).toMatchObject({ discoveredCount: 1, gameCount: 1, scoredCount: 1 });
    expect(write().scores[0].id).toBe("new");
  });

  it("keeps an all-zero observation distinct from missing current coverage", async () => {
    igdb.listPopularity.mockResolvedValue([primitive(1, 1, 0)]);
    await handler.handle();
    expect(write().scores).toEqual([{ id: "g-a", score: 0 }, { id: "g-b", score: null }, { id: "g-c", score: null }]);
  });

  it("reuses a complete same-day human cache without making provider requests", async () => {
    repo.findWikipediaInterest.mockResolvedValue([{ gameId: "g-a", article: "Example_Game", ...audience(10_000, 40_000), fetchedAt: observed }]);
    handler = createHandler(true);
    const result = await handler.handle();
    expect(wikipedia.fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ audienceCount: 1, audienceRequests: 0, audienceStatus: "complete" });
  });

  it("keeps a fresh cached window through a provider cooldown without renewing its source date", async () => {
    repo.findWikipediaInterest.mockResolvedValue([{ gameId: "g-a", article: "Example_Game", ...audience(10_000, 40_000), sourceDate: "2026-10-31", fetchedAt: observed }]);
    wikipedia.fetch.mockRejectedValue(new GameAudienceSourceError(429, date("2026-11-03T00:00:00Z")));
    handler = createHandler(true);
    const result = await handler.handle();
    expect(result).toMatchObject({ audienceCount: 1, audienceStatus: "partial" });
    expect(repo.setWikipediaInterestCooldown).toHaveBeenCalledWith(date("2026-11-03T00:00:00Z"));
    expect(repo.writeWikipediaInterest).toHaveBeenCalledWith([]);
    expect(write().sourceDates[0].calculatedAt).toEqual(date("2026-10-31T00:00:00Z"));
  });

  it("falls back to the same gaming base on cold source failure and expires stale cached windows", async () => {
    repo.findWikipediaInterest.mockResolvedValue([{ gameId: "g-a", article: "Example_Game", ...audience(100_000, 1), sourceDate: "2026-10-20", fetchedAt: observed }]);
    wikipedia.fetch.mockRejectedValue(new GameAudienceSourceError(503));
    handler = createHandler(true);
    const result = await handler.handle();
    expect(result).toMatchObject({ audienceCount: 0, audienceStatus: "unavailable" });
    expect(write().scores[0].score).toBeCloseTo(0.35 * 0.65);
    expect(write().sourceDates[0].calculatedAt).toEqual(observed);
  });

  it("honors a durable cooldown and never turns an unavailable observation into measured zero", async () => {
    repo.getWikipediaInterestCooldown.mockResolvedValue(date("2026-11-03T00:00:00Z"));
    handler = createHandler(true);
    const result = await handler.handle();
    expect(wikipedia.fetch).not.toHaveBeenCalled();
    expect(result.audienceStatus).toBe("unavailable");
    expect(write().scores[0].score).toBeGreaterThan(0);
  });

  it("reuses an article request across identities and fails on a database cache write error", async () => {
    igdb.listRankingMetadata.mockResolvedValue([1, 2].map((id) => ({ igdbId: id, ...evidence(), wikipediaArticle: "Shared_Article" })));
    handler = createHandler(true);
    await handler.handle();
    expect(wikipedia.fetch).toHaveBeenCalledTimes(1);
    expect(repo.writeWikipediaInterest.mock.lastCall[0]).toHaveLength(2);
    repo.writeWikipediaInterest.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(handler.handle()).rejects.toThrow("database unavailable");
  });

  it("bounds supplier work to 450 identities and 250 article requests", async () => {
    const values = [
      ...Array.from({ length: 200 }, (_, i) => primitive(i + 1, 1, 1000 - i)),
      ...Array.from({ length: 100 }, (_, i) => primitive(i + 201, 3, 1000 - i)),
      ...Array.from({ length: 100 }, (_, i) => primitive(i + 301, 4, 1000 - i)),
      ...Array.from({ length: 50 }, (_, i) => primitive(i + 401, 5, 1000 - i)),
    ];
    const sources = values.map((row) => ({ id: `g-${row.igdbId}`, igdbId: row.igdbId, gameModeIds: null, popularityScore: null }));
    igdb.listPopularity.mockResolvedValue(values);
    repo.listPopularitySources.mockResolvedValue(sources);
    igdb.listRankingMetadata.mockResolvedValue(sources.map((source) => ({ igdbId: source.igdbId, ...evidence(), wikipediaArticle: `Article_${source.igdbId}` })));
    handler = createHandler(true);
    const result = await handler.handle();
    expect(igdb.listRankingMetadata.mock.calls[0][0]).toHaveLength(450);
    expect(repo.findWikipediaInterest.mock.calls[0][0]).toHaveLength(450);
    expect(wikipedia.fetch).toHaveBeenCalledTimes(250);
    expect(result).toMatchObject({ audienceRequests: 250, audienceCount: 250, audienceStatus: "partial" });
  });
});
