import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListGamesHandler } from "./list.handler";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import type { IGamesRepository, GameWithRelations } from "../../games.repository.interface";
function row(id: string, patch: Partial<GameWithRelations> = {}): GameWithRelations {
  return { id, slug: id, title: id, originalTitle: null, description: null, coverImageUrl: null, releaseDate: null,
    metacriticScore: null, openCriticScore: null, hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: null, developers: [], publishers: [], genres: [], platforms: [], themes: [], ...patch } as GameWithRelations;
}
describe("catalog ListGamesHandler", () => {
  let reader: Record<keyof ISearchReader, any>;
  let repo: Record<keyof IGamesRepository, any>;
  let handler: ListGamesHandler;
  beforeEach(() => {
    reader = { searchGames: vi.fn().mockResolvedValue({ items: [], total: 0 }) } as unknown as Record<keyof ISearchReader, any>;
    repo = { findByIds: vi.fn().mockResolvedValue([]) } as unknown as Record<keyof IGamesRepository, any>;
    handler = new ListGamesHandler(reader, repo);
  });
  it("defaults page/limit and skips DB hydration for empty hits", async () => {
    expect(await handler.handle({ query: {} } as any)).toMatchObject({ items: [], page: 1, limit: 10, totalPages: 0 });
    expect(reader.searchGames).toHaveBeenCalledWith({ q: undefined, page: 1, limit: 10 });
    expect(repo.findByIds).not.toHaveBeenCalled();
  });
  it("uses fresh SQL hours and preserves search rank, counts and complete relations", async () => {
    reader.searchGames.mockResolvedValue({ items: [{ id: "b", hltbMainHours: "old" }, { id: "a", hltbMainHours: "wrong" }], total: 25 });
    const relation = { id: "dev", name: "Studio", slug: "studio" };
    repo.findByIds.mockResolvedValue([
      row("a", { hltbMainHours: "80", developers: [relation], publishers: [relation], genres: [relation], platforms: [relation], themes: [relation] }),
      row("b", { hltbMainHours: "50", updatedAt: new Date("2026-02-01T00:00:00Z") }),
    ]);
    const result = await handler.handle({ query: { q: "title", page: 2, limit: 5 } } as any);
    expect(reader.searchGames).toHaveBeenCalledWith({ q: "title", page: 2, limit: 5 });
    expect(repo.findByIds).toHaveBeenCalledWith(["b", "a"]);
    expect(result.items.map((game) => [game.id, game.hltbMainHours])).toEqual([["b", "50"], ["a", "80"]]);
    expect(result.items[0]).toMatchObject({ createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z", developers: [] });
    expect(result.items[1]).toMatchObject({ updatedAt: null, developers: [relation], publishers: [relation], genres: [relation], platforms: [relation], themes: [relation] });
    expect(result).toMatchObject({ total: 25, page: 2, limit: 5, totalPages: 5 });
  });
  it("omits unknown/deleted indexed records instead of returning stale data", async () => {
    reader.searchGames.mockResolvedValue({ items: [{ id: "missing", hltbMainHours: "old" }, { id: "current" }], total: 2 });
    repo.findByIds.mockResolvedValue([row("current")]);
    const result = await handler.handle({ query: {} } as any);
    expect(result.items.map((game) => game.id)).toEqual(["current"]);
    expect(result.items[0].hltbMainHours).toBeNull();
    expect(result.total).toBe(2);
  });
  it("keeps larger admin pages while bounding hydration batches to48", async () => {
    const ids = Array.from({ length: 100 }, (_, index) => `game-${index}`);
    reader.searchGames.mockResolvedValue({ items: ids.map((id) => ({ id })), total: 101 });
    repo.findByIds.mockImplementation(async (batch: string[]) => batch.map((id) => row(id)).reverse());
    const result = await handler.handle({ query: { limit: 100 } } as any);
    expect(repo.findByIds.mock.calls.map((call: any[]) => call[0].length)).toEqual([48, 48, 4]);
    expect(result.items.map((game) => game.id)).toEqual(ids);
    expect(result.totalPages).toBe(2);
  });
});
