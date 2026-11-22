import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { TvSeriesCatalogService } from "../search/tv-series-catalog.service";
import type { ITvSeriesRepository } from "../tv-series.repository.interface";
import { ListTvSeriesHandler } from "./list.handler";
import type { ITvSeriesCatalogService } from "../search/tv-series-catalog.service";
describe("TV series list handler", () => {
  it("trims the search and returns pagination with the source publication", async () => {
    const ranking = { mode: "alphabetical", isFresh: false, sources: [] };
    const catalog = { listPublic: vi.fn().mockResolvedValue({ items: [], total: 22, ranking }) } as Record<keyof ITvSeriesCatalogService, any>;
    const result = await new ListTvSeriesHandler(catalog).handle({ query: { q: "  Dark  " } } as any);
    expect(catalog.listPublic).toHaveBeenCalledWith({ page: 1, limit: 21, q: "Dark" });
    expect(result).toEqual({ items: [], total: 22, page: 1, limit: 21, totalPages: 2, ranking });
  });
  it("keeps empty and out-of-range pages and unknown counts intact", async () => {
    const catalog = { listPublic: vi.fn().mockResolvedValue({ items: [], total: 0, ranking: { mode: "alphabetical", isFresh: false, sources: [] } }) } as Record<keyof ITvSeriesCatalogService, any>;
    const result = await new ListTvSeriesHandler(catalog).handle({ query: { page: 3, limit: 12, q: " " } } as any);
    expect(catalog.listPublic).toHaveBeenCalledWith({ page: 3, limit: 12, q: undefined });
    expect(result.totalPages).toBe(0);
  });
});

describe("TV list publication behavior through the handler", () => {
  const ranking = { mode: "current_popularity" as const, isFresh: true, sources: [] };
  function dependencies() {
    const repo = {
      searchPublication: vi.fn().mockResolvedValue({ generation: 2, ready: true, ranking }),
      hydrateCards: vi.fn().mockResolvedValue([{ id: 7, title: "Show", rating: null, seasonCount: null }]),
      listPublic: vi.fn().mockResolvedValue({ items: [], total: 0, ranking }),
    } as unknown as Record<keyof ITvSeriesRepository, any>;
    const reader = { search: vi.fn().mockResolvedValue({ ids: [7], total: 1 }) };
    return { repo, reader, handler: new ListTvSeriesHandler(new TvSeriesCatalogService(repo, reader)) };
  }
  it("hydrates a ready Meilisearch match from the canonical catalog", async () => {
    const { repo, reader, handler } = dependencies();
    const result = await handler.handle({ query: { q: "Show" } } as any);
    expect(result.items).toEqual([{ id: 7, title: "Show", rating: null, seasonCount: null }]);
    expect(reader.search).toHaveBeenCalledWith({ page: 1, limit: 21, q: "Show", fresh: true });
    expect(repo.listPublic).not.toHaveBeenCalled();
  });
  it("uses Postgres when the publication changes during hydration", async () => {
    const { repo, handler } = dependencies();
    repo.searchPublication.mockResolvedValueOnce({ generation: 2, ready: true, ranking })
      .mockResolvedValueOnce({ generation: 3, ready: true, ranking });
    expect((await handler.handle({ query: { q: "Show" } } as any)).total).toBe(0);
    expect(repo.listPublic).toHaveBeenCalled();
  });
  it("uses Postgres when a deleted indexed hit cannot be hydrated", async () => {
    const { repo, handler } = dependencies();
    repo.hydrateCards.mockResolvedValue([]);
    await handler.handle({ query: { q: "Show" } } as any);
    expect(repo.listPublic).toHaveBeenCalled();
  });
  it("uses Postgres when the search engine is unavailable", async () => {
    const { repo, reader, handler } = dependencies();
    reader.search.mockRejectedValue(new Error("unavailable"));
    await handler.handle({ query: { q: "Show" } } as any);
    expect(repo.listPublic).toHaveBeenCalled();
  });
  it("uses the canonical recent-interest order for the browse page", async () => {
    const { repo, reader, handler } = dependencies();
    await handler.handle({ query: {} } as any);
    expect(repo.listPublic).toHaveBeenCalled();
    expect(reader.search).not.toHaveBeenCalled();
  });
});
