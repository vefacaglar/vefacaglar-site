import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ListDashboardTvHandler } from "./list.handler";
import type { ITvDashboardRepository } from "../tv-dashboard.repository.interface";

describe("ListDashboardTvHandler", () => {
  it("trims queries and preserves unknown counts while serializing timestamps", async () => {
    const row = { id: 1, title: "Example", sourceUrl: "https://www.tvmaze.com/shows/1", hierarchyComplete: false,
      seasonCount: 0, episodeCount: 0, specialCount: 0, hierarchyUpdatedAt: null, fetchedAt: new Date("2026-11-22T00:00:00Z") };
    const repo: Record<keyof ITvDashboardRepository, any> = { stats: vi.fn(), list: vi.fn().mockResolvedValue({ items: [row, { ...row, id: 2, hierarchyComplete: true, hierarchyUpdatedAt: row.fetchedAt }], total: 51 }) };
    const result = await new ListDashboardTvHandler(repo).handle({ query: { q: "  example  " } } as any);
    expect(repo.list).toHaveBeenCalledWith({ page: 1, limit: 50, q: "example", hydration: "all" });
    expect(result.totalPages).toBe(2);
    expect(result.items[0]).toMatchObject({ seasonCount: null, episodeCount: null, specialCount: null, hierarchyUpdatedAt: null, fetchedAt: "2026-11-22T00:00:00.000Z" });
    expect(result.items[1]).toMatchObject({ seasonCount: 0, episodeCount: 0, specialCount: 0, hierarchyUpdatedAt: "2026-11-22T00:00:00.000Z" });
  });
  it("passes pagination and the selected status, ignoring blank search", async () => {
    const repo: Record<keyof ITvDashboardRepository, any> = { stats: vi.fn(), list: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    await new ListDashboardTvHandler(repo).handle({ query: { page: 2, limit: 10, hydration: "pending", q: " " } } as any);
    expect(repo.list).toHaveBeenCalledWith({ page: 2, limit: 10, hydration: "pending", q: undefined });
  });
});
