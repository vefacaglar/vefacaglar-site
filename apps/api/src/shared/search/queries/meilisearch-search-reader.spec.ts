import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));

import type { IGamesRepository } from "../../../modules/catalog/games.repository.interface";
import type { IDevelopersRepository } from "../../../modules/catalog/developers.repository.interface";
import { MeilisearchError, type ISearchClient } from "../meilisearch.client";
import { reportRuntimeFailure } from "../../application-logs/runtime-failures";
import { MeilisearchSearchReader } from "./meilisearch-search-reader";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const company = (n: number, gameCount: number) => ({ id: ID(n), name: `Studio ${n}`, slug: `studio-${n}`, gameCount });
const meiliError = (httpStatus: number | undefined, code: string, message = "error") =>
  new MeilisearchError(message, { httpStatus, code });

let search: ReturnType<typeof vi.fn>;
let client: Record<keyof ISearchClient, any>;
let gamesRepo: Record<keyof IGamesRepository, any>;
let developersRepo: Record<keyof IDevelopersRepository, any>;

const reader = (enabled = true) =>
  new MeilisearchSearchReader(
    client,
    { enabled, url: "http://localhost:7700", apiKey: "" },
    developersRepo as any, {} as any, {} as any, {} as any, {} as any,
    gamesRepo as any,
    {} as any,
  );

beforeEach(() => {
  vi.mocked(reportRuntimeFailure).mockClear();
  search = vi.fn().mockResolvedValue({ hits: [], totalHits: 0 });
  client = { search, addDocuments: vi.fn(), deleteDocument: vi.fn(), indexExists: vi.fn(), waitForTask: vi.fn(),
    maxTotalHits: vi.fn().mockResolvedValue(1000) };
  gamesRepo = {
    findPublicCompaniesByIds: vi.fn().mockResolvedValue([]),
    searchPublicCompanies: vi.fn().mockResolvedValue([]),
    listPublic: vi.fn().mockResolvedValue({ items: [], total: 7 }),
  } as unknown as Record<keyof IGamesRepository, any>;
  developersRepo = { list: vi.fn().mockResolvedValue({ items: [], total: 3 }) } as unknown as Record<keyof IDevelopersRepository, any>;
});

describe("MeilisearchSearchReader.searchPublicGames", () => {
  it("browses by popularity, then release date, retrieving card fields only", async () => {
    search.mockResolvedValue({ hits: [{ id: ID(1), slug: "a", title: "A", releaseTimestamp: 0, popularityScore: 0.5 }], totalHits: 41 });
    const result = await reader().searchPublicGames({ page: 2, limit: 20 });
    expect(search).toHaveBeenCalledWith("games_en", {
      q: "",
      attributesToSearchOn: ["title", "originalTitle"],
      attributesToRetrieve: ["id", "slug", "title", "releaseDate", "criticScore", "criticScoreCount", "popularityScore"],
      sort: ["popularityScore:desc", "releaseTimestamp:desc"],
      page: 2,
      hitsPerPage: 20,
    }, { signal: expect.any(AbortSignal) });
    expect(result.total).toBe(41);
    expect(result.items.map((game) => game.id)).toEqual([ID(1)]);
  });

  it("leaves typed queries to relevance ranking (popularity is the index's last rule)", async () => {
    await reader().searchPublicGames({ q: "  zelda " });
    const params = search.mock.calls[0][1];
    expect(params).toMatchObject({ q: "zelda", page: 1, hitsPerPage: 24 });
    expect(params).not.toHaveProperty("sort");
  });

  it.each([
    meiliError(undefined, "communication_error"),
    meiliError(503, "http_503"),
    meiliError(404, "index_not_found"),
    meiliError(400, "invalid_search_sort", "Index `games_en`: Attribute `popularityScore` is not sortable."),
  ])("falls back to Postgres and cools down after a search outage (%s)", async (error) => {
    search.mockRejectedValue(error);
    const r = reader();
    expect((await r.searchPublicGames({})).total).toBe(7);
    expect(await r.searchPublicGames({})).toMatchObject({ total: 7 });
    expect(search).toHaveBeenCalledTimes(1);
    expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
    expect(reportRuntimeFailure).toHaveBeenCalledWith("search_fallback", expect.any(String), error, "warning");
  });

  it.each([
    meiliError(403, "invalid_api_key", "The provided API key is invalid."),
    meiliError(401, "missing_authorization_header", "The Authorization header is missing."),
  ])("keeps pages up on an auth failure but reports it loudly once per cooldown (%s)", async (error) => {
    vi.useFakeTimers();
    try {
      search.mockRejectedValue(error);
      const r = reader();
      expect((await r.searchPublicGames({})).total).toBe(7);
      expect((await r.searchPublicGames({})).total).toBe(7);
      expect(reportRuntimeFailure).toHaveBeenCalledTimes(1);
      expect(reportRuntimeFailure).toHaveBeenCalledWith("search_auth_failure", expect.any(String), error, "error");
      vi.advanceTimersByTime(30_000);
      expect((await r.searchPublicGames({})).total).toBe(7);
      expect(reportRuntimeFailure).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels the request when the three-second timeout fires", async () => {
    vi.useFakeTimers();
    try {
      search.mockReturnValue(new Promise(() => {}));
      const pending = reader().searchPublicGames({});
      await vi.advanceTimersByTimeAsync(3000);
      expect((await pending).total).toBe(7);
      expect((search.mock.calls[0][2].signal as AbortSignal).aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps the total at maxTotalHits when deep pages come back short", async () => {
    search.mockResolvedValue({ hits: [], totalHits: 9000 });
    client.maxTotalHits.mockResolvedValue(1000);
    expect(await reader().searchPublicGames({ page: 50, limit: 24 })).toEqual({ items: [], total: 1000 });
    search.mockResolvedValue({ hits: [{ id: ID(1), slug: "a", title: "A", releaseTimestamp: 0 }], totalHits: 9000 });
    expect((await reader().searchPublicGames({ page: 1, limit: 1 })).total).toBe(9000);
    expect(client.maxTotalHits).toHaveBeenCalledTimes(1);
  });

  it.each([
    meiliError(400, "invalid_search_page", "Invalid value"),
  ])("does not hide request errors behind the fallback (%s)", async (error) => {
    search.mockRejectedValue(error);
    await expect(reader().searchPublicGames({})).rejects.toBe(error);
    expect(gamesRepo.listPublic).not.toHaveBeenCalled();
  });
});

describe("MeilisearchSearchReader dashboard lists", () => {
  it("searches lookups by name and slug, newest first, with exact page totals", async () => {
    search.mockResolvedValue({ hits: [{ id: ID(1), name: "Studio", slug: "studio", createdAt: 1, updatedAt: 2 }], totalHits: 31 });
    const result = await reader().searchDevelopers({ q: "stu", page: 3, limit: 10 });
    expect(search).toHaveBeenCalledWith("developers_en", {
      q: "stu", attributesToSearchOn: ["name", "slug"], sort: ["createdAt:desc"], page: 3, hitsPerPage: 10,
    }, { signal: expect.any(AbortSignal) });
    expect(result.total).toBe(31);
    expect(result.items[0]).toMatchObject({ id: ID(1), name: "Studio" });
  });

  it("uses Postgres while Meilisearch is not configured", async () => {
    expect(await reader(false).searchDevelopers({ q: "stu" })).toEqual({ items: [], total: 3 });
    expect(search).not.toHaveBeenCalled();
  });
});

describe("MeilisearchSearchReader.searchPublicCompanies", () => {
  it("ranks hits by ranking score, breaks ties by game count and drops companies without games", async () => {
    search.mockResolvedValue({
      hits: [
        { id: ID(1), _rankingScore: 0.98 },
        { id: ID(2), _rankingScore: 0.9 },
        { id: ID(3), _rankingScore: 0.9 },
        { id: ID(4), _rankingScore: 0.7 },
      ],
    });
    // ID(4) has no games, so Postgres omits it; rows come back unordered.
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([company(3, 9), company(1, 1), company(2, 2)]);

    const result = await reader().searchPublicCompanies("publisher", { q: "studio", limit: 5 });

    expect(search).toHaveBeenCalledWith("publishers_en", {
      q: "studio", attributesToSearchOn: ["name"], attributesToRetrieve: ["id"], showRankingScore: true, page: 1, hitsPerPage: 15,
    }, { signal: expect.any(AbortSignal) });
    expect(gamesRepo.findPublicCompaniesByIds).toHaveBeenCalledWith("publisher", [ID(1), ID(2), ID(3), ID(4)]);
    expect(result.map((c) => c.id)).toEqual([ID(1), ID(3), ID(2)]);
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("caps results at the limit and skips Postgres when the index has no hits", async () => {
    expect(await reader().searchPublicCompanies("developer", { q: "zzz", limit: 5 })).toEqual([]);
    expect(search).toHaveBeenCalledWith("developers_en", expect.anything(), expect.anything());
    expect(gamesRepo.findPublicCompaniesByIds).not.toHaveBeenCalled();

    search.mockResolvedValue({ hits: [1, 2, 3].map((n) => ({ id: ID(n), _rankingScore: 1 - n / 10 })) });
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([company(1, 1), company(2, 1), company(3, 1)]);
    const result = await reader().searchPublicCompanies("developer", { q: "studio", limit: 2 });
    expect(result.map((c) => c.id)).toEqual([ID(1), ID(2)]);
  });

  it("uses the Postgres search when Meilisearch is disabled", async () => {
    gamesRepo.searchPublicCompanies.mockResolvedValue([company(1, 3)]);

    const result = await reader(false).searchPublicCompanies("developer", { q: "studio", limit: 5 });

    expect(search).not.toHaveBeenCalled();
    expect(gamesRepo.searchPublicCompanies).toHaveBeenCalledWith("developer", "studio", 5);
    expect(result).toEqual([company(1, 3)]);
  });

  it("falls back to Postgres when the index is missing or Meilisearch is unreachable", async () => {
    gamesRepo.searchPublicCompanies.mockResolvedValue([company(2, 1)]);
    search.mockRejectedValue(meiliError(404, "index_not_found"));

    const r = reader();
    expect(await r.searchPublicCompanies("publisher", { q: "studio", limit: 5 })).toEqual([company(2, 1)]);
    expect(gamesRepo.searchPublicCompanies).toHaveBeenCalledWith("publisher", "studio", 5);

    // The cooldown keeps the next search on Postgres without retrying Meilisearch.
    search.mockClear();
    await r.searchPublicCompanies("developer", { q: "studio", limit: 5 });
    expect(search).not.toHaveBeenCalled();
    expect(gamesRepo.searchPublicCompanies).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed Postgres hydration out of the search fallback and cooldown", async () => {
    search.mockResolvedValue({ hits: [{ id: ID(1), _rankingScore: 1 }] });
    gamesRepo.findPublicCompaniesByIds.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));

    const r = reader();
    await expect(r.searchPublicCompanies("developer", { q: "studio", limit: 5 })).rejects.toThrow("ECONNREFUSED");
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();

    // Meilisearch itself did not fail, so the next search still uses it.
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([company(1, 2)]);
    expect(await r.searchPublicCompanies("developer", { q: "studio", limit: 5 })).toEqual([company(1, 2)]);
    expect(search).toHaveBeenCalledTimes(2);
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("reads further pages while companies without games leave the group under-filled", async () => {
    const page = (from: number, count: number) => ({
      hits: Array.from({ length: count }, (_, i) => ({ id: ID(from + i), _rankingScore: 1 - (from + i) / 100 })),
    });
    // limit 2 -> 6 candidates per page; only one company per full page has games.
    search
      .mockResolvedValueOnce(page(1, 6))
      .mockResolvedValueOnce(page(7, 6))
      .mockResolvedValueOnce(page(13, 6));
    gamesRepo.findPublicCompaniesByIds.mockImplementation(async (_role: string, ids: string[]) =>
      ids.includes(ID(1)) ? [company(1, 1)] : ids.includes(ID(7)) ? [company(7, 1)] : [],
    );

    const result = await reader().searchPublicCompanies("developer", { q: "studio", limit: 2 });

    expect(search.mock.calls.map(([, params]) => [params.page, params.hitsPerPage])).toEqual([[1, 6], [2, 6]]);
    expect(result.map((c) => c.id)).toEqual([ID(1), ID(7)]);
  });

  it("stops after three pages or a short page, and keeps earlier matches when a later page fails", async () => {
    const full = (from: number) => ({
      hits: Array.from({ length: 6 }, (_, i) => ({ id: ID(from + i), _rankingScore: 0.5 })),
    });
    search.mockImplementation(async (_index: string, params: { page: number }) => full(params.page * 10));
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([]);
    expect(await reader().searchPublicCompanies("developer", { q: "studio", limit: 2 })).toEqual([]);
    expect(search).toHaveBeenCalledTimes(3);

    search.mockReset();
    search
      .mockResolvedValueOnce(full(10))
      .mockRejectedValueOnce(meiliError(503, "http_503"));
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([company(10, 4)]);
    const result = await reader().searchPublicCompanies("publisher", { q: "studio", limit: 2 });
    expect(result).toEqual([company(10, 4)]);
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("does not hide non-search errors behind the fallback", async () => {
    search.mockRejectedValue(new Error("bad request"));
    await expect(reader().searchPublicCompanies("developer", { q: "studio", limit: 5 })).rejects.toThrow("bad request");
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();
  });
});
