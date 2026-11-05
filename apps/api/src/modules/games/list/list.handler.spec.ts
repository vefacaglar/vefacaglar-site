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
      items: [{ slug: "doom", title: "Doom", coverImageUrl: null, releaseDate: "1993-12-10", metacriticScore: null, openCriticScore: null, criticScore: 85,
        popularityScore: null, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null }],
      total: 49,
      page: 2,
      limit: 24,
      totalPages: 3,
    });

    await handler.handle({ query: { q: "   " } } as any);
    expect(reader.searchPublicGames).toHaveBeenLastCalledWith({ page: 1, limit: 24, q: undefined });
  });

  it("exposes stored provider scores independently and rejects invalid values", async () => {
    reader.searchPublicGames.mockResolvedValue({ items: [
      { slug: "providers", title: "Providers", metacriticScore: 87, openCriticScore: 89, criticScore: 95, criticScoreCount: 5 },
      { slug: "zero", title: "Zero", metacriticScore: 0, openCriticScore: 0, criticScore: 0, criticScoreCount: 3 },
      { slug: "invalid", title: "Invalid", metacriticScore: Number.NaN, openCriticScore: 101, criticScore: -1, criticScoreCount: 5 },
      { slug: "few-reviews", title: "Few reviews", criticScore: 100, criticScoreCount: 2 },
    ], total: 4 });
    const result = await handler.handle({ query: {} } as any);
    expect(result.items.map(({ metacriticScore, openCriticScore, criticScore }) => ({ metacriticScore, openCriticScore, criticScore }))).toEqual([
      { metacriticScore: 87, openCriticScore: 89, criticScore: 95 },
      { metacriticScore: 0, openCriticScore: 0, criticScore: 0 },
      { metacriticScore: null, openCriticScore: null, criticScore: null },
      { metacriticScore: null, openCriticScore: null, criticScore: null },
    ]);
  });

  it("exposes popularity and completion hours without inventing missing values", async () => {
    reader.searchPublicGames.mockResolvedValue({ items: [
      { slug: "known", title: "Known", popularityScore: 0.82, hltbMainHours: "20.5", hltbMainExtraHours: "35.0", hltbCompletionistHours: "60" },
      { slug: "unknown", title: "Unknown", popularityScore: -1, hltbMainHours: "0", hltbMainExtraHours: "bad", hltbCompletionistHours: null },
      { slug: "invalid", title: "Invalid", popularityScore: Number.NaN, hltbMainHours: "Infinity" },
    ], total: 3 });
    const result = await handler.handle({ query: {} } as any);
    expect(result.items[0]).toMatchObject({ popularityScore: 0.82, hltbMainHours: "20.5", hltbMainExtraHours: "35.0", hltbCompletionistHours: "60" });
    expect(result.items[1]).toMatchObject({ popularityScore: null, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null });
    expect(result.items[2]).toMatchObject({ popularityScore: null, hltbMainHours: null });
  });

  it("keeps trending announced and undated games in the reader's public ordering", async () => {
    reader.searchPublicGames.mockResolvedValue({ items: [
      { slug: "announced", title: "Announced", releaseDate: "2099-01-01", popularityScore: 0.99 },
      { slug: "undated", title: "Undated", releaseDate: null, popularityScore: 0.98 },
      { slug: "released", title: "Released", releaseDate: "2000-01-01", popularityScore: 0.8 },
    ], total: 3 });
    const result = await handler.handle({ query: { limit: 21 } } as any);
    expect(result.items.map((game) => [game.slug, game.releaseDate])).toEqual([
      ["announced", "2099-01-01"], ["undated", null], ["released", "2000-01-01"],
    ]);
  });
});
