import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { SetMovieRatingHandler } from "./rating.handler";
import { BadRequestError } from "../../../../shared/http-errors";
import type { IMovieActivityRepository } from "../activity.repository.interface";
const mockActivityRepo = (): Record<keyof IMovieActivityRepository, any> => ({
  findWatch: vi.fn(), findPublicMovieId: vi.fn().mockResolvedValue("movie"), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(), countPublicMovies: vi.fn(),
});
const watch = { id: "watch", watchedOn: "2026-11-07", comment: null, createdAt: new Date("2026-11-07T10:00:00Z"), updatedAt: new Date("2026-11-07T10:00:00Z") };
const request = (body = {}, params = {}) => ({ params: { slug: "film", id: "watch", ...params }, body, query: {}, user: { id: "owner" } }) as any;

describe("SetMovieRatingHandler", () => {
  it.each([1, 10, null])("saves or clears the single rating %s without touching watches", async (rating) => {
    const repo = mockActivityRepo();
    expect(await new SetMovieRatingHandler(repo).handle(request({ rating }))).toEqual({ rating });
    expect(repo.setRating).toHaveBeenCalledWith("owner", "movie", rating);
    expect(repo.createWatch).not.toHaveBeenCalled(); expect(repo.deleteWatch).not.toHaveBeenCalled();
  });
  it.each([0, 11, 2.5, NaN])("rejects invalid rating %s", async (rating) => {
    const repo = mockActivityRepo();
    await expect(new SetMovieRatingHandler(repo).handle(request({ rating }))).rejects.toThrow(BadRequestError);
    expect(repo.setRating).not.toHaveBeenCalled();
  });
});
