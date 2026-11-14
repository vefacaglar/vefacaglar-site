import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import { SearchGameCompaniesHandler } from "./companies.handler";

describe("SearchGameCompaniesHandler", () => {
  let reader: Record<keyof ISearchReader, any>;
  let handler: SearchGameCompaniesHandler;

  beforeEach(() => {
    reader = { searchPublicCompanies: vi.fn().mockResolvedValue([]) } as unknown as Record<keyof ISearchReader, any>;
    handler = new SearchGameCompaniesHandler(reader);
  });

  it("returns empty groups for blank or punctuation-only queries", async () => {
    expect(await handler.handle({ query: {} } as any)).toEqual({ developers: [], publishers: [] });
    expect(await handler.handle({ query: { q: " %_ " } } as any)).toEqual({ developers: [], publishers: [] });
    expect(reader.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("searches each role through the search reader, 12 per role by default", async () => {
    await handler.handle({ query: { q: " sony " } } as any);
    expect(reader.searchPublicCompanies).toHaveBeenCalledWith("developer", { q: "sony", limit: 12 });
    expect(reader.searchPublicCompanies).toHaveBeenCalledWith("publisher", { q: "sony", limit: 12 });

    await handler.handle({ query: { q: "sony", limit: 3 } } as any);
    expect(reader.searchPublicCompanies).toHaveBeenLastCalledWith("publisher", { q: "sony", limit: 3 });
  });

  it("keeps the two roles separate and strips ids", async () => {
    reader.searchPublicCompanies.mockImplementation(async (role: string) =>
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
