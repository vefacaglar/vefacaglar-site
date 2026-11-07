import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypesenseMovieSearchReader, movieSearchParameters } from "./movie-search-reader";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";
vi.mock("../../../shared/application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));
const query = { collection: "movies_en__v2_123abc", page: 1, limit: 21, fresh: true };
const config = { enabled: true, host: "localhost", port: 8108, protocol: "http" as const, apiKey: "test" };
const id = "00000000-0000-4000-8000-000000000001";
let search: ReturnType<typeof vi.fn>;
let reader: TypesenseMovieSearchReader;
beforeEach(() => {
  search = vi.fn().mockResolvedValue({ hits: [{ document: { id } }], found: 1 });
  const client = { collections: vi.fn().mockReturnValue({ documents: () => ({ search }) }) };
  reader = new TypesenseMovieSearchReader(client as any, config);
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe("movie index query and fallback policy", () => {
  it("uses three stable sort fields, with no implicit relevance fourth field", () => {
    expect(movieSearchParameters(query)).toMatchObject({ q: "*", query_by: "title,originalTitle",
      sort_by: "interestScore:desc,titleSort:asc,tieBreakId:asc", enable_overrides: false, include_fields: "id" });
    expect(movieSearchParameters({ ...query, fresh: false })).toMatchObject({ sort_by: "titleSort:asc,tieBreakId:asc" });
  });
  it("ranks typed queries by equal-weight lexical match, then measured recognition and current interest", () => {
    expect(movieSearchParameters({ ...query, q: "Star Wars" })).toMatchObject({ q: "Star Wars", query_by_weights: "1,1",
      sort_by: "_text_match:desc,interestRecognitionRank:desc,tieBreakId:asc", text_match_type: "max_score",
      prioritize_exact_match: false, prioritize_token_position: true, prioritize_num_matching_fields: false });
    expect(movieSearchParameters({ ...query, fresh: false, q: "Amélie", personQid: "Q123" })).toMatchObject({ q: "Amélie",
      sort_by: "_text_match:desc,recognitionCount:desc,tieBreakId:asc", filter_by: "personQids:=Q123" });
  });
  it("rejects unknown collections and filter injection", () => {
    expect(() => movieSearchParameters({ ...query, collection: "games_en" })).toThrow();
    expect(() => movieSearchParameters({ ...query, collection: "movies_en__v1_legacy" })).toThrow();
    expect(() => movieSearchParameters({ ...query, personQid: "Q123 || id:*" })).toThrow();
  });
  it("returns validated IDs and counts only", async () => {
    expect(await reader.search(query)).toEqual({ ids: [id], total: 1 });
  });
  it("avoids treating punctuation-only typed searches as browse", async () => {
    expect(await reader.search({ ...query, q: "***" })).toEqual({ ids: [], total: 0 });
    expect(search).not.toHaveBeenCalled();
  });
  it("returns null while disabled", async () => {
    const disabled = new TypesenseMovieSearchReader({} as any, { ...config, enabled: false });
    expect(await disabled.search(query)).toBeNull();
  });
  it("limits a slow read to three seconds and avoids repeated calls for thirty seconds", async () => {
    search.mockReturnValue(new Promise(() => {}));
    const pending = reader.search(query);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeNull();
    expect(await reader.search(query)).toBeNull();
    expect(search).toHaveBeenCalledTimes(1);
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    search.mockResolvedValue({ hits: [], found: 0 });
    expect(await reader.search(query)).toEqual({ ids: [], total: 0 });
  });
  it.each([
    { hits: [], found: 1 },
    { hits: [{ document: { id: "invalid" } }], found: 1 },
    { hits: [{ document: { id } }, { document: { id } }], found: 2 },
    { hits: [], found: -1 },
  ])("rejects a malformed or partial index page (%j)", async (response) => {
    search.mockResolvedValue(response);
    expect(await reader.search(query)).toBeNull();
  });
  it("rejects a cutoff response even when its page and count look complete", async () => {
    search.mockResolvedValue({ hits: [{ document: { id } }], found: 1, search_cutoff: true });
    expect(await reader.search(query)).toBeNull();
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
  });
  it("accepts a normal zero-match and an out-of-range page", async () => {
    search.mockResolvedValue({ hits: [], found: 0 });
    expect(await reader.search(query)).toEqual({ ids: [], total: 0 });
    search.mockResolvedValue({ hits: [], found: 22 });
    expect(await reader.search({ ...query, page: 9 })).toEqual({ ids: [], total: 22 });
  });
});
