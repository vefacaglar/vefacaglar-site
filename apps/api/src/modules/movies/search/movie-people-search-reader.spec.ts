import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeilisearchMoviePeopleSearchReader, moviePeopleSearchParameters } from "./movie-people-search-reader";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";
import type { ISearchClient } from "../../../shared/search/meilisearch.client";
vi.mock("../../../shared/application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));
const query = { collection: "movie_people_en", q: "chris nolan", limit: 5 };
const config = { enabled: true, url: "http://localhost:7700", apiKey: "test" };
const id = "00000000-0000-4000-8000-000000000001";
let client: Record<keyof ISearchClient, any>;
let reader: MeilisearchMoviePeopleSearchReader;
beforeEach(() => {
  client = { search: vi.fn().mockResolvedValue({ hits: [{ id }], totalHits: 1 }), addDocuments: vi.fn(),
    deleteDocument: vi.fn(), indexExists: vi.fn(), waitForTask: vi.fn(), maxTotalHits: vi.fn().mockResolvedValue(1000) };
  reader = new MeilisearchMoviePeopleSearchReader(client, config);
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe("movie people index query and fallback policy", () => {
  it("searches names only and leaves credit/name tie-breaking to the index ranking rules", () => {
    expect(moviePeopleSearchParameters(query)).toEqual({ q: "chris nolan", attributesToSearchOn: ["name"],
      attributesToRetrieve: ["id"], page: 1, hitsPerPage: 5 });
  });
  it("only queries the owned people index", () => {
    expect(() => moviePeopleSearchParameters({ ...query, collection: "movies_en" })).toThrow();
    expect(() => moviePeopleSearchParameters({ ...query, collection: "movie_people_en__v1_abc" })).toThrow();
  });
  it("returns validated IDs", async () => {
    expect(await reader.search(query)).toEqual({ ids: [id] });
    expect(client.search).toHaveBeenCalledWith("movie_people_en", moviePeopleSearchParameters(query), { signal: expect.any(AbortSignal) });
  });
  it("answers punctuation-only input without a request", async () => {
    expect(await reader.search({ ...query, q: "?!" })).toEqual({ ids: [] });
    expect(client.search).not.toHaveBeenCalled();
  });
  it.each([{ hits: [{ id: "not-a-uuid" }], totalHits: 1 }, { hits: [], totalHits: 3 },
    { hits: [{ id }, { id }], totalHits: 2 }, { hits: [{ id }] }])("rejects an invalid page (%j)", async (page) => {
    client.search.mockResolvedValue(page);
    expect(await reader.search(query)).toBeNull();
  });
  it("accepts a first page shortened by maxTotalHits", async () => {
    client.maxTotalHits.mockResolvedValue(1);
    client.search.mockResolvedValue({ hits: [{ id }], totalHits: 40 });
    expect(await reader.search(query)).toEqual({ ids: [id] });
    expect(reportRuntimeFailure).not.toHaveBeenCalled();
  });
  it("cools down for 30 seconds after a failure and reports it once", async () => {
    client.search.mockRejectedValue(new Error("down"));
    expect(await reader.search(query)).toBeNull();
    expect(await reader.search(query)).toBeNull();
    expect(client.search).toHaveBeenCalledTimes(1);
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    client.search.mockResolvedValue({ hits: [], totalHits: 0 });
    expect(await reader.search(query)).toEqual({ ids: [] });
  });
  it("is disabled without Meilisearch configuration", async () => {
    expect(await new MeilisearchMoviePeopleSearchReader(client, { ...config, enabled: false }).search(query)).toBeNull();
    expect(client.search).not.toHaveBeenCalled();
  });
});
