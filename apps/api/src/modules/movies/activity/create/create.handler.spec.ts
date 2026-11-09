import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CreateMovieWatchHandler } from "./create.handler";
import { BadRequestError, ConflictError, NotFoundError } from "../../../../shared/http-errors";
import type { IMovieActivityRepository } from "../activity.repository.interface";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-08T09:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

const mockActivityRepo = (): Record<keyof IMovieActivityRepository, any> => ({
  findWatch: vi.fn(), findPublicMovieId: vi.fn().mockResolvedValue("movie"), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(),
});
const watch = { id: "watch", watchedOn: "2026-11-07", comment: null, createdAt: new Date("2026-11-07T10:00:00Z"), updatedAt: new Date("2026-11-07T10:00:00Z") };
const request = (body = {}, params = {}) => ({ params: { slug: "film", id: "watch", ...params }, body, query: {}, user: { id: "owner" } }) as any;

describe("CreateMovieWatchHandler", () => {
  it("passes a stable retry ID, movie, owner and exact calendar date without writing a rating", async () => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue(watch);
    const handler = new CreateMovieWatchHandler(repo);
    await handler.handle(request({ id: "watch", watchedOn: "2026-11-07" }));
    expect(repo.createWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", null, false);
    expect(repo.setRating).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30", "2025-02-29", "0000-01-01", "2026-13-01", "2026-1-01", "2026-11-07T00:00:00Z"])("rejects invalid calendar date %s", async (watchedOn) => {
    const repo = mockActivityRepo();
    await expect(new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn }))).rejects.toThrow(BadRequestError);
    expect(repo.createWatch).not.toHaveBeenCalled();
  });
  it("accepts a valid leap day", async () => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue({ ...watch, watchedOn: "2024-02-29" });
    expect((await new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "2024-02-29" }))).watchedOn).toBe("2024-02-29");
  });
  it.each([undefined, null])("stores an omitted or null date as unknown without inventing today", async (watchedOn) => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue({ ...watch, watchedOn: null });
    const result = await new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn }));
    expect(repo.createWatch).toHaveBeenCalledWith("owner", "movie", "watch", null, null, false);
    expect(result.watchedOn).toBeNull();
    expect(repo.setRating).not.toHaveBeenCalled();
  });
  it("rejects a non-null empty date instead of treating invalid input as unknown", async () => {
    const repo = mockActivityRepo();
    await expect(new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "" }))).rejects.toThrow(BadRequestError);
    expect(repo.createWatch).not.toHaveBeenCalled();
  });
  it.each([
    ["2026-11-07T20:59:59Z", "2026-11-07", true],
    ["2026-11-07T20:59:59Z", "2026-11-08", false],
    ["2026-11-07T21:00:00Z", "2026-11-08", true],
    ["2026-11-07T21:00:00Z", "2026-11-09", false],
  ])("validates %s against the Istanbul calendar day for %s", async (now, watchedOn, allowed) => {
    vi.setSystemTime(new Date(now));
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue({ ...watch, watchedOn });
    const result = new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn }));
    if (allowed) {
      expect((await result).watchedOn).toBe(watchedOn);
      expect(repo.createWatch).toHaveBeenCalled();
    } else {
      await expect(result).rejects.toThrow("err_log_future_date");
      expect(repo.createWatch).not.toHaveBeenCalled();
    }
  });
  it("reports a conflicting retry without exposing another record", async () => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue(null);
    await expect(new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "2026-11-07" }))).rejects.toThrow(ConflictError);
  });
  it("rejects missing movies", async () => {
    const repo = mockActivityRepo(); repo.findPublicMovieId.mockResolvedValue(null);
    await expect(new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "2026-11-07" }))).rejects.toThrow(NotFoundError);
    expect(repo.createWatch).not.toHaveBeenCalled();
  });
  it("normalizes a private comment and returns it only in the owned activity response", async () => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue({ ...watch, comment: "A quiet ending.\nWorth revisiting." });
    const result = await new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "2026-11-07", comment: "  A quiet ending.\nWorth revisiting.  " }));
    expect(repo.createWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", "A quiet ending.\nWorth revisiting.", false);
    expect(result.comment).toBe("A quiet ending.\nWorth revisiting.");
  });
  it.each([undefined, null, "  \n "]) ("normalizes an empty comment to null", async (comment) => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue(watch);
    await new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "2026-11-07", comment }));
    expect(repo.createWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", null, false);
  });
  it("accepts 2,000 Unicode characters and rejects an oversized comment before writing", async () => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue(watch);
    const handler = new CreateMovieWatchHandler(repo);
    await handler.handle(request({ id: "watch", watchedOn: "2026-11-07", comment: "🎬".repeat(2000) }));
    expect(repo.createWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", "🎬".repeat(2000), false);
    repo.createWatch.mockClear();
    await expect(handler.handle(request({ id: "watch", watchedOn: "2026-11-07", comment: "x".repeat(2001) }))).rejects.toThrow(BadRequestError);
    expect(repo.createWatch).not.toHaveBeenCalled();
  });

  it("includes explicit sharing in the idempotent request and owned response", async () => {
    const repo = mockActivityRepo(); repo.createWatch.mockResolvedValue({ ...watch, sharedAt: new Date("2026-11-08T00:00:00Z") });
    const result = await new CreateMovieWatchHandler(repo).handle(request({ id: "watch", watchedOn: "2026-11-07", comment: "  Shared  ", isPublic: true }));
    expect(repo.createWatch).toHaveBeenCalledWith("owner", "movie", "watch", "2026-11-07", "Shared", true);
    expect(result.isPublic).toBe(true);
  });

});
