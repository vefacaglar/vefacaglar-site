import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { DeleteMovieWatchHandler } from "./delete.handler";
import { NotFoundError } from "../../../../shared/http-errors";
import type { IMovieActivityRepository } from "../activity.repository.interface";
const mockActivityRepo = (): Record<keyof IMovieActivityRepository, any> => ({
  findPublicMovieId: vi.fn().mockResolvedValue("movie"), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(), countPublicMovies: vi.fn(),
});
const watch = { id: "watch", watchedOn: "2026-11-07", createdAt: new Date("2026-11-07T10:00:00Z"), updatedAt: new Date("2026-11-07T10:00:00Z") };
const request = (body = {}, params = {}) => ({ params: { slug: "film", id: "watch", ...params }, body, query: {}, user: { id: "owner" } }) as any;

describe("DeleteMovieWatchHandler", () => {
  it("deletes only the owned movie watch and preserves the rating", async () => {
    const repo = mockActivityRepo(); repo.deleteWatch.mockResolvedValue(true);
    await new DeleteMovieWatchHandler(repo).handle(request());
    expect(repo.deleteWatch).toHaveBeenCalledWith("owner", "movie", "watch");
    expect(repo.setRating).not.toHaveBeenCalled();
  });
  it("treats a missing or non-owned watch as not found", async () => {
    const repo = mockActivityRepo(); repo.deleteWatch.mockResolvedValue(false);
    await expect(new DeleteMovieWatchHandler(repo).handle(request())).rejects.toThrow(NotFoundError);
  });
});
