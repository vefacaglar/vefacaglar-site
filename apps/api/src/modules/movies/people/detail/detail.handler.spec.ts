import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetMoviePersonHandler } from "./detail.handler";
import type { IMoviesRepository } from "../../movies.repository.interface";

function mockRepository(): Record<keyof IMoviesRepository, any> {
  return {
    ensureSourceAndSeeds: vi.fn(), sourceState: vi.fn(), saveSourceState: vi.fn(), insertDiscovered: vi.fn(),
    hydrationCandidates: vi.fn(), refreshCandidates: vi.fn(), recognitionCandidates: vi.fn(), persistMovie: vi.fn(),
    markEntityFailure: vi.fn(),
    findLabels: vi.fn(), labelRefreshCandidates: vi.fn(), writeLabels: vi.fn(), hasPendingWork: vi.fn(),
    listPublic: vi.fn(), findPublicPersonHeader: vi.fn(), findPublicBySlug: vi.fn(), findPublicPerson: vi.fn(),
  };
}

const person = { wikidataId: "Q25191", name: "Christopher Nolan" };
const storedFilm = {
  slug: "inception-q25188", title: "Inception", releaseDate: null, releaseYear: 2010, runtimeMinutes: 148,
  posterImageUrl: "https://upload.wikimedia.org/poster.jpg",
  posterAttribution: { provider: "wikipedia" as const, rightsKind: "reusable" as const,
    sourceUrl: "https://en.wikipedia.org/wiki/File:Inception.jpg", artist: null, license: "CC BY-SA 4.0", licenseUrl: null },
  roles: ["director", "producer"] as const,
};

const handle = (repo: Record<keyof IMoviesRepository, any>, wikidataId = "Q25191") =>
  new GetMoviePersonHandler(repo).handle({ params: { wikidataId } } as any);

describe("public movie person handler", () => {
  it("returns every film unpaged, with suppressed poster fields and roles", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue({ person, items: [storedFilm], total: 1 });
    const result = await handle(repo);
    expect(repo.findPublicPerson).toHaveBeenCalledWith("Q25191");
    expect(result).toEqual({ person, items: [{ ...storedFilm, posterImageUrl: null, posterAttribution: null }], total: 1 });
    expect(JSON.stringify(result.items)).not.toContain("wikimedia.org");
    expect(JSON.stringify(result.items)).not.toContain("wikipedia.org");
  });

  it("keeps the repository order (newest year first, unknown years last) for a large filmography", async () => {
    const repo = mockRepository();
    const films = [
      ...Array.from({ length: 300 }, (_, i) => ({ ...storedFilm, slug: `film-${i}`, title: `Film ${i}`, releaseYear: 2020 - Math.floor(i / 10) })),
      { ...storedFilm, slug: "undated", title: "Undated", releaseYear: null },
    ];
    repo.findPublicPerson.mockResolvedValue({ person, items: films, total: films.length });
    const result = await handle(repo);
    expect(result.items).toHaveLength(301);
    expect(result.total).toBe(301);
    expect(result.items.map((item) => item.slug)).toEqual(films.map((item) => item.slug));
    expect(result.items.at(-1)?.releaseYear).toBeNull();
    expect(result).not.toHaveProperty("page");
    expect(result).not.toHaveProperty("totalPages");
  });

  it("returns a known person with an empty catalog and a stable name fallback", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue({ person: { wikidataId: "Q123", name: "  " }, items: [], total: 0 });
    expect(await handle(repo, "Q123")).toEqual({ person: { wikidataId: "Q123", name: "Q123" }, items: [], total: 0 });
  });

  it("returns a translated page-not-found error for an unknown person", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue(null);
    await expect(handle(repo, "Q999")).rejects.toMatchObject({ statusCode: 404, message: "err_page_not_found" });
  });

  it("propagates repository failures rather than displaying an empty filmography", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockRejectedValue(new Error("Database unavailable"));
    await expect(handle(repo)).rejects.toThrow("Database unavailable");
  });
});
