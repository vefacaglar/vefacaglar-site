import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetMovieHandler } from "./detail.handler";
import type { IMoviesRepository } from "../movies.repository.interface";
describe("public movie detail handler", () => {
  it("returns not found for an unavailable public movie", async () => {
    const repo = { findPublicBySlug: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof IMoviesRepository, any>;
    await expect(new GetMovieHandler(repo).handle({ params: { slug: "film-q1" } } as any)).rejects.toMatchObject({ statusCode: 404 });
  });
});
