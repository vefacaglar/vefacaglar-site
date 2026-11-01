import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListGamesHandler } from "./list.handler";
import type { ISearchReader } from "../../../shared/search/queries/search-reader.interface";

describe("ListGamesHandler", () => {
  let reader: Record<keyof ISearchReader, any>;
  let handler: ListGamesHandler;

  beforeEach(() => {
    reader = { searchPublicGames: vi.fn().mockResolvedValue({ items: [], total: 0 }) } as unknown as Record<keyof ISearchReader, any>;
    handler = new ListGamesHandler(reader);
  });

  it("defaults to page 1 and 24 per page", async () => {
    await handler.handle({ query: {} } as any);
    expect(reader.searchPublicGames).toHaveBeenCalledWith({ page: 1, limit: 24, q: undefined });
  });

  it("hides critic scores based on fewer than 3 reviews", async () => {
    reader.searchPublicGames.mockResolvedValue({
      items: [
        { id: "a", slug: "a", title: "A", coverImageUrl: null, releaseDate: null, criticScore: 100, criticScoreCount: 1 },
        { id: "b", slug: "b", title: "B", coverImageUrl: null, releaseDate: null, criticScore: 80, criticScoreCount: 3 },
      ],
      total: 2,
    });

    const result = await handler.handle({ query: {} } as any);

    expect(result.items.map((g) => g.criticScore)).toEqual([null, 80]);
  });

  it("trims the query, ignores blank ones and maps card fields", async () => {
    reader.searchPublicGames.mockResolvedValue({
      items: [{ id: "g-1", slug: "doom", title: "Doom", coverImageUrl: null, releaseDate: "1993-12-10", criticScore: 85, criticScoreCount: 12 }],
      total: 49,
    });

    const result = await handler.handle({ query: { q: "  doom ", page: 2 } } as any);

    expect(reader.searchPublicGames).toHaveBeenCalledWith({ page: 2, limit: 24, q: "doom" });
    expect(result).toEqual({
      items: [{ slug: "doom", title: "Doom", coverImageUrl: null, releaseDate: "1993-12-10", criticScore: 85 }],
      total: 49,
      page: 2,
      limit: 24,
      totalPages: 3,
    });

    await handler.handle({ query: { q: "   " } } as any);
    expect(reader.searchPublicGames).toHaveBeenLastCalledWith({ page: 1, limit: 24, q: undefined });
  });
});
