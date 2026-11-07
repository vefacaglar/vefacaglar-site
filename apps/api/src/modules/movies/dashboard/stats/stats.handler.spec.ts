import "reflect-metadata";
import { it, expect, vi } from "vitest";
import { GetMovieStatsHandler } from "./stats.handler";
import type { IMovieActivityRepository } from "../../activity/activity.repository.interface";
it("returns the repository's canonical public catalog count", async () => {
  const repo: Record<keyof IMovieActivityRepository, any> = { findPublicMovieId: vi.fn(), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(), countPublicMovies: vi.fn().mockResolvedValue(350000) };
  expect(await new GetMovieStatsHandler(repo).handle()).toEqual({ movieCount: 350000 });
});
