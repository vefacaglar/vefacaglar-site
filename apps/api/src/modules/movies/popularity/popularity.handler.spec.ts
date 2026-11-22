import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshMoviePopularityHandler } from "./popularity.handler";
import { WikipediaInterestClient } from "./wikipedia-interest.client";
import { MoviePopularityService } from "./popularity.service";
import { MovieInterestSourceError, type IMoviePopularityRepository, type IWikipediaInterestClient } from "./popularity.types";
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const state = () => ({ sourceDate: null, publishedAt: null, cooldownUntil: null, failureCount: 0, lastAttemptAt: null, errorCode: null, articleCount: null, mappedArticleCount: null, missingArticleCount: null, duplicateQidCount: null, observedMovieCount: null });
const projection = () => ({ sourceDate: yesterday(), observations: [{ wikidataId: "Q47703", views: 100 }], rollingObservations: [{ wikidataId: "Q47703", views: 100 }], articleCount: 1000, mappedArticleCount: 1, missingArticleCount: 999, duplicateQidCount: 0, requests: 21, durationMs: 100 });
let repo: Record<keyof IMoviePopularityRepository, any>;
let client: Record<keyof IWikipediaInterestClient, any>;
const run = () => new RefreshMoviePopularityHandler(new MoviePopularityService(repo, client)).handle();
beforeEach(() => {
  repo = { state: vi.fn().mockResolvedValue(state()), wikidataCooldown: vi.fn().mockResolvedValue(null), interestCandidates: vi.fn().mockResolvedValue([]), knownMovieQids: vi.fn().mockResolvedValue([]), publish: vi.fn().mockResolvedValue({ status: "published", observedMovieCount: 1 }), recordFailure: vi.fn() };
  client = { collect: vi.fn().mockResolvedValue({ status: "complete", projection: projection() }) };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("movie Wikipedia-interest refresh handler", () => {
  it("publishes only a complete validated observation and reports measured counters", async () => {
    expect(await run()).toMatchObject({ status: "published", sourceDate: yesterday(), observedMovieCount: 1, articleCount: 1000, requests: 21 });
    expect(repo.publish).toHaveBeenCalledWith(projection());
    expect(repo.recordFailure).not.toHaveBeenCalled();
  });
  it("passes bounded catalog candidates and reports supplemental coverage", async () => {
    const candidates = [{ wikidataId: "Q123", article: "Recent film" }];
    repo.interestCandidates.mockResolvedValue(candidates);
    client.collect.mockResolvedValue({ status: "complete", projection: { ...projection(), rollingObservations: [{ wikidataId: "Q123", views: 500 }], additionalObservationCount: 1 } });
    expect(await run()).toMatchObject({ status: "published", additionalObservedMovieCount: 1 });
    expect(client.collect).toHaveBeenCalledWith(null, expect.objectContaining({ candidates }));
  });
  it("publishes the validated main source when optional coverage fails", async () => {
    client.collect.mockResolvedValue({ status: "complete", projection: { ...projection(), additionalObservationCount: 0, additionalErrorCode: "aqs_request_failed" } });
    expect(await run()).toMatchObject({ status: "published", additionalObservedMovieCount: 0, additionalErrorCode: "aqs_request_failed" });
    expect(repo.publish).toHaveBeenCalledOnce();
  });
  it("preserves the last chart on any partial mapping failure", async () => {
    const retryAt = new Date(Date.now() + 120000);
    client.collect.mockRejectedValue(new MovieInterestSourceError("wikidata", "wikidata_incomplete_title_mapping", retryAt));
    await expect(run()).rejects.toThrow("wikidata_incomplete_title_mapping");
    expect(repo.publish).not.toHaveBeenCalled();
    expect(repo.recordFailure).toHaveBeenCalledWith("wikidata_incomplete_title_mapping", "wikidata", retryAt);
  });
  it("does not publish a client's structurally incomplete projection", async () => {
    client.collect.mockResolvedValue({ status: "complete", projection: { ...projection(), articleCount: 999 } });
    await expect(run()).rejects.toThrow("incomplete_movie_interest_projection");
    expect(repo.publish).not.toHaveBeenCalled();
  });
  it("accepts zero eligible films from a complete source as a valid empty result", async () => {
    repo.publish.mockResolvedValue({ status: "published", observedMovieCount: 0 });
    expect(await run()).toMatchObject({ status: "published", observedMovieCount: 0, articleCount: 1000 });
  });
  it("does not renew the chart or pretend zero views when publication is delayed", async () => {
    repo.state.mockResolvedValue({ ...state(), sourceDate: "2026-01-01", observedMovieCount: 38, articleCount: 1000 });
    client.collect.mockResolvedValue({ status: "delayed", requests: 3, durationMs: 100 });
    expect(await run()).toMatchObject({ status: "delayed", sourceDate: "2026-01-01", observedMovieCount: 38 });
    expect(repo.publish).not.toHaveBeenCalled();
  });
  it("does not request historical or current partial data when yesterday is accepted", async () => {
    repo.state.mockResolvedValue({ ...state(), sourceDate: yesterday(), observedMovieCount: 38 });
    expect(await run()).toMatchObject({ status: "unchanged", requests: 0 });
    expect(client.collect).not.toHaveBeenCalled();
  });
  it("respects the later AQS/shared-Wikidata cooldown without fetching or changing facts", async () => {
    repo.state.mockResolvedValue({ ...state(), cooldownUntil: new Date(Date.now() + 60000) });
    const shared = new Date(Date.now() + 180000);
    repo.wikidataCooldown.mockResolvedValue(shared);
    expect(await run()).toMatchObject({ status: "cooldown", nextRetryAt: shared.toISOString(), requests: 0 });
    expect(client.collect).not.toHaveBeenCalled();
    expect(repo.recordFailure).not.toHaveBeenCalled();
  });
  it("keeps an AQS failure in its own provider state", async () => {
    const retryAt = new Date(Date.now() + 3 * 86400000);
    client.collect.mockRejectedValue(new MovieInterestSourceError("aqs", "aqs_http_429", retryAt));
    await expect(run()).rejects.toThrow("aqs_http_429");
    expect(repo.recordFailure).toHaveBeenCalledWith("aqs_http_429", "aqs", retryAt);
    expect(repo.publish).not.toHaveBeenCalled();
  });
});

describe("movie refresh through the bounded source client", () => {
  function source(failedArticle = "") {
    const now = new Date("2026-11-22T08:00:00Z");
    let clock = now.getTime();
    // Advance the pacing clock without waiting in a unit test.
    vi.spyOn(Date, "now").mockImplementation(() => clock += 1000);
    const request = vi.fn(async (input: URL) => {
      const url = new URL(input);
      let body: unknown;
      if (url.pathname.includes("/top/")) {
        body = { items: [{ project: "en.wikipedia", access: "all-access", year: "2026", month: "11", day: "21",
          articles: Array.from({ length: 1000 }, (_, i) => ({ article: `Article_${i}`, views: 100000 - i, rank: i + 1 })) }] };
      } else if (url.hostname === "www.wikidata.org") {
        body = { entities: Object.fromEntries(url.searchParams.get("titles")!.split("|").map((title) => {
          const index = Number(title.split(" ")[1]);
          const id = `Q${index + 1000}`;
          return [id, { id, sitelinks: { enwiki: { site: "enwiki", title } } }];
        })) };
      } else {
        if (failedArticle && url.pathname.includes(failedArticle)) return new Response("{}", { status: 503 });
        const article = decodeURIComponent(url.pathname.split("/")[9]);
        body = { items: ["2026111900", "2026112000", "2026112100"].map((timestamp, i) => ({
          project: "en.wikipedia", article, access: "all-access", agent: "user", granularity: "daily", timestamp,
          views: [100, 200, 300][i],
        })) };
      }
      return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", request);
    const client = new WikipediaInterestClient();
    const run = () => new RefreshMoviePopularityHandler(new MoviePopularityService(repo, {
      collect: (after, options) => client.collect(after, { ...options, now }),
    })).handle();
    return { request, run };
  }
  it("measures identical three-day windows for feed leaders and additional catalog films", async () => {
    const { run, request } = source();
    repo.knownMovieQids.mockResolvedValue(["Q1000"]);
    repo.interestCandidates.mockResolvedValue([{ wikidataId: "Q777", article: "Recent film" }]);
    expect((await run()).status).toBe("published");
    const projection = repo.publish.mock.calls[0][0];
    expect(projection.rollingObservations).toEqual([{ wikidataId: "Q1000", views: 233 }, { wikidataId: "Q777", views: 233 }]);
    expect(projection.observations[0].views).toBe(100000);
    expect(projection.additionalObservationCount).toBe(1);
    const urls = request.mock.calls.map(([url]) => url.href).filter((url) => url.includes("/per-article/"));
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => url.includes("/user/") && url.endsWith("/daily/2026111900/2026112100"))).toBe(true);
  });
  it("discards a partial supplement while retaining fully measured feed leaders", async () => {
    const { run } = source("Missing");
    repo.knownMovieQids.mockResolvedValue(["Q1000"]);
    repo.interestCandidates.mockResolvedValue([{ wikidataId: "Q777", article: "Recent film" }, { wikidataId: "Q778", article: "Missing" }]);
    expect((await run()).status).toBe("published");
    const projection = repo.publish.mock.calls[0][0];
    expect(projection.rollingObservations).toEqual([{ wikidataId: "Q1000", views: 233 }]);
    expect(projection.additionalObservationCount).toBe(0);
    expect(projection.additionalErrorCode).toBe("aqs_http_503");
    expect(repo.recordFailure).toHaveBeenCalledWith("optional_aqs_http_503", "aqs", expect.any(Date));
  });
  it("reserves feed-leader coverage before optional catalog samples", async () => {
    const { run, request } = source();
    repo.knownMovieQids.mockResolvedValue(Array.from({ length: 1000 }, (_, i) => `Q${i + 1000}`));
    repo.interestCandidates.mockResolvedValue(Array.from({ length: 16 }, (_, i) => ({ wikidataId: `Q${i + 5000}`, article: `Extra_${i}` })));
    await run();
    const projection = repo.publish.mock.calls[0][0];
    expect(projection.rollingObservations).toHaveLength(64);
    expect(projection.rollingObservations.slice(0, 48).map((row: { wikidataId: string }) => row.wikidataId))
      .toEqual(Array.from({ length: 48 }, (_, i) => `Q${i + 1000}`));
    expect(request.mock.calls.length).toBeLessThanOrEqual(96);
  });
  it("preserves the accepted chart if a feed leader cannot be measured", async () => {
    const { run } = source("Article_0");
    repo.knownMovieQids.mockResolvedValue(["Q1000"]);
    await expect(run()).rejects.toThrow("aqs_http_503");
    expect(repo.publish).not.toHaveBeenCalled();
  });

});
