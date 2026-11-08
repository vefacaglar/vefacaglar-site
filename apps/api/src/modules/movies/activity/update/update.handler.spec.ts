import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UpdateMovieWatchHandler } from "./update.handler";
import { BadRequestError, NotFoundError } from "../../../../shared/http-errors";
import type { IMovieActivityRepository } from "../activity.repository.interface";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-08T09:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

const mockActivityRepo = (): Record<keyof IMovieActivityRepository, any> => ({
  findWatch: vi.fn().mockImplementation(async () => watch), findPublicMovieId: vi.fn().mockResolvedValue("movie"), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(), countPublicMovies: vi.fn(),
});
const watch = { id: "watch", watchedOn: "2026-11-07", comment: null, createdAt: new Date("2026-11-07T10:00:00Z"), updatedAt: new Date("2026-11-07T10:00:00Z") };
const request = (body = {}, params = {}) => ({ params: { slug: "film", id: "watch", ...params }, body, query: {}, user: { id: "owner" } }) as any;

describe("UpdateMovieWatchHandler", () => {
  it("scopes date edits by user, movie and watch without touching ratings", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue(watch);
    await new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-07" }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", undefined, undefined);
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
  it("preserves an omitted date while editing a comment or sharing", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue(watch);
    await new UpdateMovieWatchHandler(repo).handle(request({ comment: "  Updated review  ", isPublic: false }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", undefined, "Updated review", false);
  });
  it("explicitly clears a date without changing the rating or omitted fields", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue({ ...watch, watchedOn: null });
    const result = await new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: null }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", null, undefined, undefined);
    expect(result.watchedOn).toBeNull();
    expect(repo.setRating).not.toHaveBeenCalled();
  });
  it("rejects an empty date before updating", async () => {
    const repo = mockActivityRepo();
    await expect(new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "" }))).rejects.toThrow(BadRequestError);
    expect(repo.updateWatch).not.toHaveBeenCalled();
  });
  it("reads the exact owned watch before allowing a legacy future date", async () => {
    const repo = mockActivityRepo(); repo.findWatch.mockResolvedValue(null);
    await expect(new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2099-01-01" }))).rejects.toThrow(NotFoundError);
    expect(repo.findWatch).toHaveBeenCalledWith("owner", "movie", "watch");
    expect(repo.updateWatch).not.toHaveBeenCalled();
  });
  it("does not write an unchanged legacy future date back while editing another field", async () => {
    const repo = mockActivityRepo(); repo.findWatch.mockResolvedValue({ ...watch, watchedOn: "2099-01-01" });
    repo.updateWatch.mockResolvedValue({ ...watch, watchedOn: "2099-01-01" });
    const result = await new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2099-01-01", comment: "Edited" }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", undefined, "Edited", undefined);
    expect(result.watchedOn).toBe("2099-01-01");
  });
  it("rejects a changed future date and permits clearing a legacy future date", async () => {
    const repo = mockActivityRepo(); repo.findWatch.mockResolvedValue({ ...watch, watchedOn: "2099-01-01" });
    repo.updateWatch.mockResolvedValue({ ...watch, watchedOn: null });
    const handler = new UpdateMovieWatchHandler(repo);
    await expect(handler.handle(request({ watchedOn: "2099-01-02" }))).rejects.toThrow("err_log_future_date");
    expect(repo.updateWatch).not.toHaveBeenCalled();
    expect((await handler.handle(request({ watchedOn: null }))).watchedOn).toBeNull();
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", null, undefined, undefined);
  });
  it("accepts Istanbul today after local midnight while the UTC server is still on yesterday", async () => {
    vi.setSystemTime(new Date("2026-11-07T21:00:00Z"));
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue({ ...watch, watchedOn: "2026-11-08" });
    await new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-08" }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-08", undefined, undefined);
  });
  it("normalizes comment edits and supports explicitly clearing them", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue(watch);
    const handler = new UpdateMovieWatchHandler(repo);
    await handler.handle(request({ watchedOn: "2026-11-07", comment: "  Rewatched with friends.  " }));
    expect(repo.updateWatch).toHaveBeenLastCalledWith("owner", "movie", "watch", "2026-11-07", "Rewatched with friends.", undefined);
    await handler.handle(request({ watchedOn: "2026-11-07", comment: "  " }));
    expect(repo.updateWatch).toHaveBeenLastCalledWith("owner", "movie", "watch", "2026-11-07", null, undefined);
  });
  it("rejects an oversized comment before any update", async () => {
    const repo = mockActivityRepo();
    await expect(new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-07", comment: "x".repeat(2001) }))).rejects.toThrow(BadRequestError);
    expect(repo.updateWatch).not.toHaveBeenCalled();
  });

  it("passes an explicit unshare independently of an omitted comment", async () => {
    const repo = mockActivityRepo(); repo.updateWatch.mockResolvedValue({ ...watch, sharedAt: null });
    const result = await new UpdateMovieWatchHandler(repo).handle(request({ watchedOn: "2026-11-07", isPublic: false }));
    expect(repo.updateWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", undefined, false);
    expect(result.isPublic).toBe(false);
  });

});
