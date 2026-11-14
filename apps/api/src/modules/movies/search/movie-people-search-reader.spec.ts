import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypesenseMoviePeopleSearchReader, moviePeopleSearchParameters } from "./movie-people-search-reader";
import { reportRuntimeFailure } from "../../../shared/application-logs/runtime-failures";
vi.mock("../../../shared/application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));
const query = { collection: "movie_people_en__v1_123abc", q: "chris nolan", limit: 5 };
const config = { enabled: true, host: "localhost", port: 8108, protocol: "http" as const, apiKey: "test" };
const id = "00000000-0000-4000-8000-000000000001";
let search: ReturnType<typeof vi.fn>;
let reader: TypesenseMoviePeopleSearchReader;
beforeEach(() => {
  search = vi.fn().mockResolvedValue({ hits: [{ document: { id } }], found: 1 });
  const client = { collections: vi.fn().mockReturnValue({ documents: () => ({ search }) }) };
  reader = new TypesenseMoviePeopleSearchReader(client as any, config);
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe("movie people index query and fallback policy", () => {
  it("ranks by lexical match, then public credits, then name", () => {
    expect(moviePeopleSearchParameters(query)).toMatchObject({ q: "chris nolan", query_by: "name", per_page: 5, page: 1,
      sort_by: "_text_match:desc,publicCreditCount:desc,nameSort:asc", include_fields: "id", enable_overrides: false });
  });
  it("only queries owned people generations", () => {
    expect(() => moviePeopleSearchParameters({ ...query, collection: "movies_en__v2_abc" })).toThrow();
    expect(() => moviePeopleSearchParameters({ ...query, collection: "movie_people_en__v1_x/evil" })).toThrow();
  });
  it("returns validated IDs", async () => {
    expect(await reader.search(query)).toEqual({ ids: [id] });
  });
  it("answers punctuation-only input without a request", async () => {
    expect(await reader.search({ ...query, q: "?!" })).toEqual({ ids: [] });
    expect(search).not.toHaveBeenCalled();
  });
  it.each([{ hits: [{ document: { id: "not-a-uuid" } }], found: 1 }, { hits: [], found: 3 },
    { hits: [{ document: { id } }, { document: { id } }], found: 2 }])("rejects an invalid page (%j)", async (page) => {
    search.mockResolvedValue(page);
    expect(await reader.search(query)).toBeNull();
  });
  it("cools down for 30 seconds after a failure and reports it once", async () => {
    search.mockRejectedValue(new Error("down"));
    expect(await reader.search(query)).toBeNull();
    expect(await reader.search(query)).toBeNull();
    expect(search).toHaveBeenCalledTimes(1);
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    search.mockResolvedValue({ hits: [], found: 0 });
    expect(await reader.search(query)).toEqual({ ids: [] });
  });
  it("is disabled without Typesense configuration", async () => {
    const client = { collections: vi.fn() };
    expect(await new TypesenseMoviePeopleSearchReader(client as any, { ...config, enabled: false }).search(query)).toBeNull();
    expect(client.collections).not.toHaveBeenCalled();
  });
});
