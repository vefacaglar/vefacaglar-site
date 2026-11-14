import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));

import type { IGamesRepository } from "../../../modules/catalog/games.repository.interface";
import { TypesenseSearchReader } from "./typesense-search-reader";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const company = (n: number, gameCount: number) => ({ id: ID(n), name: `Studio ${n}`, slug: `studio-${n}`, gameCount });

describe("TypesenseSearchReader.searchPublicCompanies", () => {
  let search: ReturnType<typeof vi.fn>;
  let collections: ReturnType<typeof vi.fn>;
  let gamesRepo: Record<keyof IGamesRepository, any>;

  const reader = (enabled = true) =>
    new TypesenseSearchReader(
      { collections } as any,
      { enabled, host: "", port: 0, protocol: "https", apiKey: "" },
      {} as any, {} as any, {} as any, {} as any, {} as any,
      gamesRepo as any,
      {} as any,
    );

  beforeEach(() => {
    search = vi.fn().mockResolvedValue({ hits: [], found: 0 });
    collections = vi.fn(() => ({ documents: () => ({ search }) }));
    gamesRepo = {
      findPublicCompaniesByIds: vi.fn().mockResolvedValue([]),
      searchPublicCompanies: vi.fn().mockResolvedValue([]),
    } as unknown as Record<keyof IGamesRepository, any>;
  });

  it("ranks Typesense hits by text match, breaks ties by game count and drops companies without games", async () => {
    search.mockResolvedValue({
      hits: [
        { document: { id: ID(1) }, text_match: 900, text_match_info: { score: "578730123365187705" } },
        { document: { id: ID(2) }, text_match: 800, text_match_info: { score: "578730123365187700" } },
        { document: { id: ID(3) }, text_match: 800, text_match_info: { score: "578730123365187700" } },
        { document: { id: ID(4) }, text_match: 700 },
      ],
    });
    // ID(4) has no games, so Postgres omits it; rows come back unordered.
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([company(3, 9), company(1, 1), company(2, 2)]);

    const result = await reader().searchPublicCompanies("publisher", { q: "studio", limit: 5 });

    expect(collections).toHaveBeenCalledWith("publishers_en");
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ q: "studio", query_by: "name", per_page: 15 }));
    expect(gamesRepo.findPublicCompaniesByIds).toHaveBeenCalledWith("publisher", [ID(1), ID(2), ID(3), ID(4)]);
    expect(result.map((c) => c.id)).toEqual([ID(1), ID(3), ID(2)]);
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("caps results at the limit and skips Postgres when Typesense has no hits", async () => {
    expect(await reader().searchPublicCompanies("developer", { q: "zzz", limit: 5 })).toEqual([]);
    expect(collections).toHaveBeenCalledWith("developers_en");
    expect(gamesRepo.findPublicCompaniesByIds).not.toHaveBeenCalled();

    search.mockResolvedValue({ hits: [1, 2, 3].map((n) => ({ document: { id: ID(n) }, text_match: 10 - n })) });
    gamesRepo.findPublicCompaniesByIds.mockResolvedValue([company(1, 1), company(2, 1), company(3, 1)]);
    const result = await reader().searchPublicCompanies("developer", { q: "studio", limit: 2 });
    expect(result.map((c) => c.id)).toEqual([ID(1), ID(2)]);
  });

  it("uses the Postgres search when Typesense is disabled", async () => {
    gamesRepo.searchPublicCompanies.mockResolvedValue([company(1, 3)]);

    const result = await reader(false).searchPublicCompanies("developer", { q: "studio", limit: 5 });

    expect(search).not.toHaveBeenCalled();
    expect(gamesRepo.searchPublicCompanies).toHaveBeenCalledWith("developer", "studio", 5);
    expect(result).toEqual([company(1, 3)]);
  });

  it("falls back to Postgres when the collection is missing or Typesense is unreachable", async () => {
    gamesRepo.searchPublicCompanies.mockResolvedValue([company(2, 1)]);
    search.mockRejectedValue(Object.assign(new Error("Not found."), { httpStatus: 404 }));

    const r = reader();
    expect(await r.searchPublicCompanies("publisher", { q: "studio", limit: 5 })).toEqual([company(2, 1)]);
    expect(gamesRepo.searchPublicCompanies).toHaveBeenCalledWith("publisher", "studio", 5);

    // The cooldown keeps the next search on Postgres without retrying Typesense.
    search.mockClear();
    await r.searchPublicCompanies("developer", { q: "studio", limit: 5 });
    expect(search).not.toHaveBeenCalled();
    expect(gamesRepo.searchPublicCompanies).toHaveBeenCalledTimes(2);
  });

  it("does not hide non-search errors behind the fallback", async () => {
    search.mockRejectedValue(new Error("bad request"));
    await expect(reader().searchPublicCompanies("developer", { q: "studio", limit: 5 })).rejects.toThrow("bad request");
    expect(gamesRepo.searchPublicCompanies).not.toHaveBeenCalled();
  });
});
