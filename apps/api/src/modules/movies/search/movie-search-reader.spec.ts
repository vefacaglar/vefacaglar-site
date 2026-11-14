import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeilisearchMovieSearchReader, movieSearchParameters } from "./movie-search-reader";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";
import { MeilisearchError, type ISearchClient } from "../../../shared/search/meilisearch.client";
vi.mock("../../../shared/application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));
const query = { collection: "movies_en", page: 1, limit: 21, fresh: true };
const config = { enabled: true, url: "http://localhost:7700", apiKey: "test" };
const id = "00000000-0000-4000-8000-000000000001";
let client: Record<keyof ISearchClient, any>;
let reader: MeilisearchMovieSearchReader;
beforeEach(() => {
  client = { search: vi.fn().mockResolvedValue({ hits: [{ id }], totalHits: 1 }), addDocuments: vi.fn(),
    deleteDocument: vi.fn(), indexExists: vi.fn(), waitForTask: vi.fn(), maxTotalHits: vi.fn().mockResolvedValue(1000) };
  reader = new MeilisearchMovieSearchReader(client, config);
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe("movie index query and fallback policy", () => {
  it("browses with three stable sort fields and no relevance", () => {
    expect(movieSearchParameters(query)).toEqual({ q: "", attributesToSearchOn: ["title", "originalTitle"], attributesToRetrieve: ["id"],
      page: 1, hitsPerPage: 21, sort: ["interestScore:desc", "titleSort:asc", "tieBreakId:asc"] });
    expect(movieSearchParameters({ ...query, fresh: false })).toMatchObject({ sort: ["titleSort:asc", "tieBreakId:asc"] });
  });
  it("ranks typed queries by relevance, then measured recognition and current interest", () => {
    expect(movieSearchParameters({ ...query, q: "Star Wars" })).toMatchObject({ q: "Star Wars",
      attributesToSearchOn: ["title", "originalTitle"], sort: ["interestRecognitionRank:desc", "tieBreakId:asc"] });
    expect(movieSearchParameters({ ...query, fresh: false, q: "Amélie", personQid: "Q123" })).toMatchObject({ q: "Amélie",
      sort: ["recognitionCount:desc", "tieBreakId:asc"], filter: 'personQids = "Q123"' });
  });
  it("rejects unknown indexes and filter injection", () => {
    expect(() => movieSearchParameters({ ...query, collection: "games_en" })).toThrow();
    expect(() => movieSearchParameters({ ...query, collection: "movies_en__v2_legacy" })).toThrow();
    expect(() => movieSearchParameters({ ...query, personQid: 'Q123" OR id EXISTS' })).toThrow();
  });
  it("returns validated IDs and counts only", async () => {
    expect(await reader.search(query)).toEqual({ ids: [id], total: 1 });
    expect(client.search).toHaveBeenCalledWith("movies_en", movieSearchParameters(query), { signal: expect.any(AbortSignal) });
    expect(client.maxTotalHits).not.toHaveBeenCalled();
  });
  it("avoids treating punctuation-only typed searches as browse", async () => {
    expect(await reader.search({ ...query, q: "***" })).toEqual({ ids: [], total: 0 });
    expect(client.search).not.toHaveBeenCalled();
  });
  it("returns null while disabled", async () => {
    const disabled = new MeilisearchMovieSearchReader(client, { ...config, enabled: false });
    expect(await disabled.search(query)).toBeNull();
    expect(client.search).not.toHaveBeenCalled();
  });
  it("limits a slow read to three seconds, cancels it, and avoids repeated calls for thirty seconds", async () => {
    client.search.mockReturnValue(new Promise(() => {}));
    const pending = reader.search(query);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeNull();
    expect((client.search.mock.calls[0][2].signal as AbortSignal).aborted).toBe(true);
    expect(await reader.search(query)).toBeNull();
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    client.search.mockResolvedValue({ hits: [], totalHits: 0 });
    expect(await reader.search(query)).toEqual({ ids: [], total: 0 });
  });
  it.each([
    { hits: [], totalHits: 1 },
    { hits: [{ id: "invalid" }], totalHits: 1 },
    { hits: [{ id }, { id }], totalHits: 2 },
    { hits: [], totalHits: -1 },
    { hits: [{ id }], estimatedTotalHits: 1 },
  ])("rejects a malformed or partial index page (%j)", async (response) => {
    client.search.mockResolvedValue(response);
    expect(await reader.search(query)).toBeNull();
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
  });
  it("accepts a normal zero-match and an out-of-range page", async () => {
    client.search.mockResolvedValue({ hits: [], totalHits: 0 });
    expect(await reader.search(query)).toEqual({ ids: [], total: 0 });
    client.search.mockResolvedValue({ hits: [], totalHits: 22 });
    expect(await reader.search({ ...query, page: 9 })).toEqual({ ids: [], total: 22 });
    expect(reportRuntimeFailure).not.toHaveBeenCalled();
  });
  it("caps the total at maxTotalHits instead of treating unreachable pages as corrupt", async () => {
    client.maxTotalHits.mockResolvedValue(30);
    client.search.mockResolvedValue({ hits: [{ id }], totalHits: 5000 });
    expect(await reader.search({ ...query, page: 2, limit: 29 })).toEqual({ ids: [id], total: 30 });
    client.search.mockResolvedValue({ hits: [], totalHits: 5000 });
    expect(await reader.search({ ...query, page: 3 })).toEqual({ ids: [], total: 30 });
    expect(client.maxTotalHits).toHaveBeenCalledWith("movies_en", { signal: expect.any(AbortSignal) });
    expect(reportRuntimeFailure).not.toHaveBeenCalled();
    // Short even with the cap: still a partial page.
    client.search.mockResolvedValue({ hits: [], totalHits: 5000 });
    expect(await reader.search({ ...query, page: 1 })).toBeNull();
  });
  it("reports a rejected API key as an error-level auth failure", async () => {
    client.search.mockRejectedValue(new MeilisearchError("The provided API key is invalid.", { httpStatus: 403, code: "invalid_api_key" }));
    expect(await reader.search(query)).toBeNull();
    expect(reportRuntimeFailure).toHaveBeenCalledWith("search_auth_failure", expect.any(String), expect.any(MeilisearchError), "error");
  });
});
