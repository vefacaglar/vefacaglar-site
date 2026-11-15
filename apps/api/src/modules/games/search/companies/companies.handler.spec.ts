import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import { SearchGameCompaniesHandler } from "./companies.handler";

const TIE = ["developers", "publishers", "games"];

describe("SearchGameCompaniesHandler", () => {
  let reader: Record<keyof ISearchReader, any>;
  let handler: SearchGameCompaniesHandler;

  beforeEach(() => {
    reader = { searchPublicCompanies: vi.fn().mockResolvedValue([]), searchPublicGames: vi.fn().mockResolvedValue({ items: [], total: 0 }) } as unknown as Record<keyof ISearchReader, any>;
    handler = new SearchGameCompaniesHandler(reader);
  });

  it("returns empty groups for blank or punctuation-only queries", async () => {
    expect(await handler.handle({ query: {} } as any)).toEqual({ developers: [], publishers: [], order: TIE });
    expect(await handler.handle({ query: { q: " %_ " } } as any)).toEqual({ developers: [], publishers: [], order: TIE });
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
      order: TIE,
    });
  });

  describe("section order", () => {
    const company = (name: string) => [{ id: "c", name, slug: name.toLowerCase(), gameCount: 2 }];
    const game = (title: string) => ({ items: [{ title }], total: 1 });

    it("puts the studios above the games grid when the studio name matches best", async () => {
      reader.searchPublicCompanies.mockImplementation(async (role: string) => (role === "developer" ? company("Bethesda") : []));
      reader.searchPublicGames.mockResolvedValue(game("Bethesda Pinball"));
      expect((await handler.handle({ query: { q: "bethesda" } } as any)).order).toEqual(["developers", "games", "publishers"]);
      expect(reader.searchPublicGames).toHaveBeenCalledWith({ q: "bethesda", page: 1, limit: 5 });
    });

    it("puts the games grid first when a title matches best", async () => {
      reader.searchPublicCompanies.mockImplementation(async (role: string) => (role === "developer" ? company("Starfield Studios") : []));
      reader.searchPublicGames.mockResolvedValue(game("Starfield"));
      expect((await handler.handle({ query: { q: "starfield" } } as any)).order).toEqual(["games", "developers", "publishers"]);
    });

    it("keeps the tie order instead of failing when the games lookup fails", async () => {
      reader.searchPublicGames.mockRejectedValue(new Error("down"));
      reader.searchPublicCompanies.mockImplementation(async () => company("Bethesda"));
      expect((await handler.handle({ query: { q: "bethesda" } } as any)).order).toEqual(TIE);
    });
  });
});
