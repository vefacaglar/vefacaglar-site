import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ListMoviesHandler } from "./list.handler";
import type { IMoviesRepository } from "../movies.repository.interface";
describe("public movie list handler", () => {
  it("defaults to 21 and returns only public repository cards with page totals", async () => {
    const card = { slug: "the-godfather-q47703", title: "The Godfather", releaseDate: null, releaseYear: 1972, runtimeMinutes: 175, posterImageUrl: null };
    const ranking = { mode: "wikipedia_interest", sourceDate: "2026-11-04", sourceUrl: "https://wikimedia.org/", isFresh: true };
    const repo = { listPublic: vi.fn().mockResolvedValue({ items: [card], total: 22, ranking }) } as unknown as Record<keyof IMoviesRepository, any>;
    const result = await new ListMoviesHandler(repo).handle({ query: { q: " Godfather " } } as any);
    expect(repo.listPublic).toHaveBeenCalledWith({ page: 1, limit: 21, q: "Godfather" });
    expect(result).toEqual({ items: [card], total: 22, page: 1, limit: 21, totalPages: 2, ranking });
  });
  it("keeps a snapshot descriptor on an empty or out-of-range page", async () => {
    const ranking = { mode: "alphabetical", sourceDate: null, sourceUrl: null, isFresh: false };
    const repo = { listPublic: vi.fn().mockResolvedValue({ items: [], total: 22, ranking }) } as unknown as Record<keyof IMoviesRepository, any>;
    expect(await new ListMoviesHandler(repo).handle({ query: { page: 9 } } as any)).toEqual({ items: [], total: 22, ranking, page: 9, limit: 21, totalPages: 2 });
  });

});
