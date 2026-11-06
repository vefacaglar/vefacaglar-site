import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshMoviePopularityHandler } from "./popularity.handler";
import { MoviePopularityService } from "./popularity.service";
import { MovieInterestSourceError, type IMoviePopularityRepository, type IWikipediaInterestClient } from "./popularity.types";
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const state = () => ({ sourceDate: null, publishedAt: null, cooldownUntil: null, failureCount: 0, lastAttemptAt: null, errorCode: null, articleCount: null, mappedArticleCount: null, missingArticleCount: null, duplicateQidCount: null, observedMovieCount: null });
const projection = () => ({ sourceDate: yesterday(), observations: [{ wikidataId: "Q47703", views: 100 }], articleCount: 1000, mappedArticleCount: 1, missingArticleCount: 999, duplicateQidCount: 0, requests: 21, durationMs: 100 });
let repo: Record<keyof IMoviePopularityRepository, any>;
let client: Record<keyof IWikipediaInterestClient, any>;
const run = () => new RefreshMoviePopularityHandler(new MoviePopularityService(repo, client)).handle();
beforeEach(() => {
  repo = { state: vi.fn().mockResolvedValue(state()), wikidataCooldown: vi.fn().mockResolvedValue(null), publish: vi.fn().mockResolvedValue({ status: "published", observedMovieCount: 1 }), recordFailure: vi.fn() };
  client = { collect: vi.fn().mockResolvedValue({ status: "complete", projection: projection() }) };
});
describe("movie Wikipedia-interest refresh handler", () => {
  it("publishes only a complete validated observation and reports measured counters", async () => {
    expect(await run()).toMatchObject({ status: "published", sourceDate: yesterday(), observedMovieCount: 1, articleCount: 1000, requests: 21 });
    expect(repo.publish).toHaveBeenCalledWith(projection());
    expect(repo.recordFailure).not.toHaveBeenCalled();
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
