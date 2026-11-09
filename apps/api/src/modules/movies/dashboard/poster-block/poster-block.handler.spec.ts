import "reflect-metadata";
import type { FastifyRequest } from "fastify";
import { describe, it, expect, vi } from "vitest";
import { SetMoviePosterBlockHandler } from "./poster-block.handler";
import type { IMovieDashboardRepository } from "../movies-dashboard.repository.interface";
import type { MoviePosterBlockBody, MoviePosterBlockParams } from "./poster-block.schema";
const id = "5f0c2c0e-0000-4000-8000-000000000001";
const request = (blocked: boolean) => ({ params: { id }, body: { blocked } }) as FastifyRequest<{ Params: MoviePosterBlockParams; Body: MoviePosterBlockBody }>;
const mockRepo = (result: unknown): Record<keyof IMovieDashboardRepository, any> => ({ stats: vi.fn(), list: vi.fn(), setPosterBlocked: vi.fn().mockResolvedValue(result) });
describe("SetMoviePosterBlockHandler", () => {
  it("blocks a poster and reports when it was blocked", async () => {
    const repo = mockRepo({ id, posterBlockedAt: new Date("2026-11-01T10:00:00Z") });
    expect(await new SetMoviePosterBlockHandler(repo).handle(request(true))).toEqual({ id, posterBlocked: true, posterBlockedAt: "2026-11-01T10:00:00.000Z" });
    expect(repo.setPosterBlocked).toHaveBeenCalledWith(id, true, expect.any(Date));
  });
  it("unblocks a poster", async () => {
    const repo = mockRepo({ id, posterBlockedAt: null });
    expect(await new SetMoviePosterBlockHandler(repo).handle(request(false))).toEqual({ id, posterBlocked: false, posterBlockedAt: null });
    expect(repo.setPosterBlocked).toHaveBeenCalledWith(id, false, expect.any(Date));
  });
  it("rejects an unknown movie", async () => {
    await expect(new SetMoviePosterBlockHandler(mockRepo(null)).handle(request(true))).rejects.toMatchObject({ message: "err_movie_not_found" });
  });
});
