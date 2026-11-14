import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import { SearchGameCompaniesHandler } from "./companies.handler";

describe("SearchGameCompaniesHandler", () => {
  let repo: Record<keyof IGamesRepository, any>;
  let handler: SearchGameCompaniesHandler;

  beforeEach(() => {
    repo = { searchPublicCompanies: vi.fn().mockResolvedValue([]) } as unknown as Record<keyof IGamesRepository, any>;
    handler = new SearchGameCompaniesHandler(repo);
  });

  it("returns empty groups for blank or punctuation-only queries", async () => {
    expect(await handler.handle({ query: {} } as any)).toEqual({ developers: [], publishers: [] });
    expect(await handler.handle({ query: { q: " %_ " } } as any)).toEqual({ developers: [], publishers: [] });
    expect(repo.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("defaults to 12 per role and honors an explicit limit", async () => {
    await handler.handle({ query: { q: " sony " } } as any);
    expect(repo.searchPublicCompanies).toHaveBeenCalledWith("developer", "sony", 12);
    expect(repo.searchPublicCompanies).toHaveBeenCalledWith("publisher", "sony", 12);

    await handler.handle({ query: { q: "sony", limit: 3 } } as any);
    expect(repo.searchPublicCompanies).toHaveBeenLastCalledWith("publisher", "sony", 3);
  });

  it("keeps the two roles separate and strips ids", async () => {
    repo.searchPublicCompanies.mockImplementation(async (role: string) =>
      role === "developer"
        ? [{ id: "d1", name: "Studio", slug: "studio", gameCount: 4 }]
        : [{ id: "p1", name: "Studio", slug: "studio", gameCount: 1 }],
    );

    expect(await handler.handle({ query: { q: "stu" } } as any)).toEqual({
      developers: [{ name: "Studio", slug: "studio", gameCount: 4 }],
      publishers: [{ name: "Studio", slug: "studio", gameCount: 1 }],
    });
  });
});
