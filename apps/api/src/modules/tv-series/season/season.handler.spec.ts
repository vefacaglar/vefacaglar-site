import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetTvSeasonHandler } from "./season.handler";
import type { ITvSeriesRepository } from "../tv-series.repository.interface";
describe("TV season handler", () => {
  it("passes both parent and season IDs and preserves special episodes", async () => {
    const data = { series: { id: 1, title: "Series" }, season: { id: 20 }, episodes: [{ id: 100, number: null, isSpecial: true, rating: null }] };
    const repo = { findSeason: vi.fn().mockResolvedValue(data) } as unknown as Record<keyof ITvSeriesRepository, any>;
    expect(await new GetTvSeasonHandler(repo).handle({ params: { id: 1, seasonId: 20 } } as any)).toEqual(data);
    expect(repo.findSeason).toHaveBeenCalledWith(1, 20);
  });
  it("returns not found when the season belongs to another series", async () => {
    const repo = { findSeason: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof ITvSeriesRepository, any>;
    await expect(new GetTvSeasonHandler(repo).handle({ params: { id: 1, seasonId: 20 } } as any)).rejects.toMatchObject({ statusCode: 404, message: "err_tv_season_not_found" });
  });
});
