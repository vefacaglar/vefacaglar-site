import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { UpdateMovieWatchHandler } from "./update.handler";
import { BadRequestError, NotFoundError } from "../../../../shared/http-errors";
import type { IMovieActivityRepository } from "../activity.repository.interface";
const mockActivityRepo = (): Record<keyof IMovieActivityRepository, any> => ({
  findPublicMovieId: vi.fn().mockResolvedValue("movie"), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(), countPublicMovies: vi.fn(),
});
const watch = { id: "watch", watchedOn: "2026-11-07", comment: null, createdAt: new Date("2026-11-07T10:00:00Z"), updatedAt: new Date("2026-11-07T10:00:00Z") };
const request = (body = {}, params = {}) => ({ params: { slug: "film", id: "watch", ...params }, body, query: {}, user: { id: "owner" } }) as any;

describe("UpdateMovieWatchHandler", () => {
  it("scopes date edits by user, movie and watch without touching ratings", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue(watch);
    await new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-07" }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", undefined);
    expect(repo.setRating).not.toHaveBeenCalled();
  });
  it("treats a missing or non-owned watch as not found", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue(null);
    await expect(new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-07" }))).rejects.toThrow(NotFoundError);
  });
  it("rejects impossible dates before updating", async () => {
    const repo = mockActivityRepo();
    await expect(new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-04-31" }))).rejects.toThrow(BadRequestError);
    expect(repo.updateWatch).not.toHaveBeenCalled();
  });
  it("normalizes comment edits and supports explicitly clearing them", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue(watch);
    const handler = new UpdateMovieWatchHandler(repo);
    await handler.handle(request({ watchedOn: "2026-11-07", comment: "  Rewatched with friends.  " }));
    expect(repo.updateWatch).toHaveBeenLastCalledWith("owner", "movie", "watch", "2026-11-07", "Rewatched with friends.");
    await handler.handle(request({ watchedOn: "2026-11-07", comment: "  " }));
    expect(repo.updateWatch).toHaveBeenLastCalledWith("owner", "movie", "watch", "2026-11-07", null);
  });
  it("rejects an oversized comment before any update", async () => {
    const repo = mockActivityRepo();
    await expect(new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-07", comment: "x".repeat(2001) }))).rejects.toThrow(BadRequestError);
    expect(repo.updateWatch).not.toHaveBeenCalled();
  });

});
