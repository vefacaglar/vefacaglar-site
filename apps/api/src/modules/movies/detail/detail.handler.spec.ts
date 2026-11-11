import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetMovieHandler } from "./detail.handler";
import type { IMoviesRepository } from "../movies.repository.interface";

describe("public movie detail handler", () => {
  it("returns movie details with posterImageUrl and posterAttribution forced to null", async () => {
    const stored = {
      slug: "the-godfather-q47703",
      title: "The Godfather",
      releaseDate: "1972-03-14",
      releaseYear: 1972,
      runtimeMinutes: 175,
      posterImageUrl: "https://upload.wikimedia.org/wikipedia/commons/poster.jpg",
      posterAttribution: {
        provider: "commons" as const,
        rightsKind: "reusable" as const,
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Poster.jpg",
        artist: "Studio",
        license: "Public domain",
        licenseUrl: null,
      },
      wikidataId: "Q47703",
      imdbId: "tt0068646",
      description: "1972 crime film",
      originalTitle: "The Godfather",
      genres: [],
      companies: [],
      credits: [],
      sourceUpdatedAt: "2026-11-05T00:00:00.000Z",
    };
    const repo = { findPublicBySlug: vi.fn().mockResolvedValue(stored) } as unknown as Record<keyof IMoviesRepository, any>;
    const result = await new GetMovieHandler(repo).handle({ params: { slug: "the-godfather-q47703" } } as any);
    expect(result).toEqual({ ...stored, posterImageUrl: null, posterAttribution: null });
    expect(JSON.stringify(result)).not.toContain("wikimedia.org");
  });

  it("returns not found for an unavailable public movie", async () => {
    const repo = { findPublicBySlug: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof IMoviesRepository, any>;
    await expect(new GetMovieHandler(repo).handle({ params: { slug: "film-q1" } } as any)).rejects.toMatchObject({ statusCode: 404 });
  });
});
