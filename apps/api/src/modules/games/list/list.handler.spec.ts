import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListGamesHandler } from "./list.handler";
import type { IGamesRepository } from "../../catalog/games.repository.interface";

describe("ListGamesHandler", () => {
  let repo: Record<keyof IGamesRepository, any>;
  let handler: ListGamesHandler;

  beforeEach(() => {
    repo = { listPublic: vi.fn().mockResolvedValue({ items: [], total: 0 }) } as unknown as Record<keyof IGamesRepository, any>;
    handler = new ListGamesHandler(repo);
  });

  it("defaults to page 1 and 24 per page", async () => {
    await handler.handle({ query: {} } as any);
    expect(repo.listPublic).toHaveBeenCalledWith({ page: 1, limit: 24, q: undefined });
  });

  it("trims the query, ignores blank ones and maps card fields", async () => {
    repo.listPublic.mockResolvedValue({
      items: [{ id: "g-1", slug: "doom", title: "Doom", coverImageUrl: null, releaseDate: "1993-12-10", criticScore: 85 }],
      total: 49,
    });

    const result = await handler.handle({ query: { q: "  doom ", page: 2 } } as any);

    expect(repo.listPublic).toHaveBeenCalledWith({ page: 2, limit: 24, q: "doom" });
    expect(result).toEqual({
      items: [{ slug: "doom", title: "Doom", coverImageUrl: null, releaseDate: "1993-12-10", criticScore: 85 }],
      total: 49,
      page: 2,
      limit: 24,
      totalPages: 3,
    });

    await handler.handle({ query: { q: "   " } } as any);
    expect(repo.listPublic).toHaveBeenLastCalledWith({ page: 1, limit: 24, q: undefined });
  });
});
