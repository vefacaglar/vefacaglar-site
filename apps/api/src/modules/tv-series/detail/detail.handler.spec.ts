import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetTvSeriesHandler } from "./detail.handler";
import type { ITvSeriesRepository } from "../tv-series.repository.interface";
describe("TV series detail handler", () => {
  it("preserves pending hierarchy and nullable ratings and counts", async () => {
    const row = { id: 1, hierarchyStatus: "pending", seasonCount: null, episodeCount: null, rating: null, seasons: [], orphanSpecials: [] };
    const repo = { findPublic: vi.fn().mockResolvedValue(row) } as unknown as Record<keyof ITvSeriesRepository, any>;
    expect(await new GetTvSeriesHandler(repo).handle({ params: { id: 1 } } as any)).toEqual(row);
    expect(repo.findPublic).toHaveBeenCalledWith(1);
  });
  it("returns a localized not-found error for an unavailable series", async () => {
    const repo = { findPublic: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof ITvSeriesRepository, any>;
    await expect(new GetTvSeriesHandler(repo).handle({ params: { id: 999 } } as any)).rejects.toMatchObject({ statusCode: 404, message: "err_tv_series_not_found" });
  });
});
