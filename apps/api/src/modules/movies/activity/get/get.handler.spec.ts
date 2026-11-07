import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { GetMovieActivityHandler } from "./get.handler";
import { NotFoundError } from "../../../../shared/http-errors";
import type { IMovieActivityRepository } from "../activity.repository.interface";
const mockActivityRepo = (): Record<keyof IMovieActivityRepository, any> => ({
  findPublicMovieId: vi.fn().mockResolvedValue("movie"), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn(), countPublicMovies: vi.fn(),
});
const watch = { id: "watch", watchedOn: "2026-11-07", comment: null, createdAt: new Date("2026-11-07T10:00:00Z"), updatedAt: new Date("2026-11-07T10:00:00Z") };
const request = (body = {}, params = {}) => ({ params: { slug: "film", id: "watch", ...params }, body, query: {}, user: { id: "owner" } }) as any;

describe("GetMovieActivityHandler", () => {
  it("returns repeat watches and a single independent rating with page defaults", async () => {
    const repo = mockActivityRepo(); repo.getActivity.mockResolvedValue({ rating: 8, watches: [{ ...watch, comment: "Private viewing note" }, { ...watch, id: "watch2" }], total: 2 });
    const result = await new GetMovieActivityHandler(repo).handle(request());
    expect(repo.getActivity).toHaveBeenCalledWith("owner", "movie", 1, 20);
    expect(result).toMatchObject({ rating: 8, total: 2, totalPages: 1, page: 1, limit: 20 });
    expect(result.watches.map((w) => w.id)).toEqual(["watch", "watch2"]);
    expect(result.watches[0].comment).toBe("Private viewing note");
    expect(result.watches[0].createdAt).toBe("2026-11-07T10:00:00.000Z");
  });
  it("keeps total metadata for an empty later page", async () => {
    const repo = mockActivityRepo(); repo.getActivity.mockResolvedValue({ rating: null, watches: [], total: 3 });
    const req = request(); req.query = { page: 5, limit: 2 };
    expect(await new GetMovieActivityHandler(repo).handle(req)).toMatchObject({ watches: [], total: 3, totalPages: 2, page: 5 });
  });
  it("rejects unavailable films before reading personal activity", async () => {
    const repo = mockActivityRepo(); repo.findPublicMovieId.mockResolvedValue(null);
    await expect(new GetMovieActivityHandler(repo).handle(request())).rejects.toThrow(NotFoundError);
    expect(repo.getActivity).not.toHaveBeenCalled();
  });
});
