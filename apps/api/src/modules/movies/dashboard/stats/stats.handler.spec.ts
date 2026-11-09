import "reflect-metadata";
import { it, expect, vi } from "vitest";
import { GetMovieStatsHandler } from "./stats.handler";
import type { IMovieDashboardRepository } from "../movies-dashboard.repository.interface";
it("returns the repository's catalog counts, keeping movieCount as the public film count", async () => {
  const repo: Record<keyof IMovieDashboardRepository, any> = { list: vi.fn(), setPosterBlocked: vi.fn(),
    stats: vi.fn().mockResolvedValue({ catalogCount: 900000, publicFilmCount: 350000, withPosterCount: 120000, posterBlockedCount: 2 }) };
  expect(await new GetMovieStatsHandler(repo).handle()).toEqual({ movieCount: 350000, catalogCount: 900000, withPosterCount: 120000, posterBlockedCount: 2 });
});
