import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetMoviePersonHandler } from "./detail.handler";
import type { IMoviesRepository } from "../../movies.repository.interface";

function mockRepository(): Record<keyof IMoviesRepository, any> {
  return {
    ensureSourceAndSeeds: vi.fn(), sourceState: vi.fn(), saveSourceState: vi.fn(), insertDiscovered: vi.fn(),
    hydrationCandidates: vi.fn(), refreshCandidates: vi.fn(), posterInputsCandidates: vi.fn(), recognitionCandidates: vi.fn(), persistMovie: vi.fn(),
    posterCandidates: vi.fn(), persistPoster: vi.fn(), markPosterFailure: vi.fn(), markEntityFailure: vi.fn(),
    findLabels: vi.fn(), labelRefreshCandidates: vi.fn(), writeLabels: vi.fn(), hasPendingWork: vi.fn(),
    listPublic: vi.fn(), findPublicPersonHeader: vi.fn(), hydratePublicIds: vi.fn(), findPublicBySlug: vi.fn(), findPublicPerson: vi.fn(),
  };
}

const ranking = { mode: "wikipedia_interest" as const, sourceDate: "2026-11-06", sourceUrl: "https://wikimedia.org/", isFresh: true };
const person = { wikidataId: "Q25191", name: "Christopher Nolan" };
const film = {
  slug: "inception-q25188", title: "Inception", releaseDate: null, releaseYear: 2010, runtimeMinutes: 148,
  posterImageUrl: "https://upload.wikimedia.org/poster.jpg",
  posterAttribution: { provider: "wikipedia" as const, rightsKind: "non-free" as const,
    sourceUrl: "https://en.wikipedia.org/wiki/File:Inception.jpg", artist: null, license: "Fair use", licenseUrl: null },
  roles: ["director", "producer"] as const,
};

describe("public movie person handler", () => {
  it("returns the person's catalog films with public poster metadata, roles, and default pagination", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue({ person, items: [film], total: 22, ranking });
    const result = await new GetMoviePersonHandler(repo).handle({ params: { wikidataId: person.wikidataId }, query: {} } as any);
    expect(repo.findPublicPerson).toHaveBeenCalledWith("Q25191", { page: 1, limit: 21 });
    expect(result).toEqual({ person, items: [film], total: 22, page: 1, limit: 21, totalPages: 2, ranking });
  });

  it("preserves an out-of-range page and the real total instead of treating the person as missing", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue({ person, items: [], total: 25, ranking });
    expect(await new GetMoviePersonHandler(repo).handle({ params: { wikidataId: "Q25191" }, query: { page: 8, limit: 10 } } as any))
      .toEqual({ person, items: [], total: 25, ranking, page: 8, limit: 10, totalPages: 3 });
    expect(repo.findPublicPerson).toHaveBeenCalledWith("Q25191", { page: 8, limit: 10 });
  });

  it("returns a known person with an empty catalog and a stable name fallback", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue({ person: { wikidataId: "Q123", name: "  " }, items: [], total: 0, ranking });
    expect(await new GetMoviePersonHandler(repo).handle({ params: { wikidataId: "Q123" }, query: {} } as any))
      .toEqual({ person: { wikidataId: "Q123", name: "Q123" }, items: [], total: 0, ranking, page: 1, limit: 21, totalPages: 0 });
  });

  it("returns a translated page-not-found error for an unknown person", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockResolvedValue(null);
    await expect(new GetMoviePersonHandler(repo).handle({ params: { wikidataId: "Q999" }, query: {} } as any))
      .rejects.toMatchObject({ statusCode: 404, message: "err_page_not_found" });
  });

  it("propagates repository failures rather than displaying an empty filmography", async () => {
    const repo = mockRepository();
    repo.findPublicPerson.mockRejectedValue(new Error("Database unavailable"));
    await expect(new GetMoviePersonHandler(repo).handle({ params: { wikidataId: "Q25191" }, query: {} } as any))
      .rejects.toThrow("Database unavailable");
  });
});
