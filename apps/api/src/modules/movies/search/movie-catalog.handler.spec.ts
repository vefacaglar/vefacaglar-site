import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListMoviesHandler } from "../list/list.handler";
import { GetMoviePersonHandler } from "../people/detail/detail.handler";
import type { IMoviesRepository } from "../movies.repository.interface";
import { MovieCatalogService } from "./movie-catalog.service";
import type { IMovieSearchStateRepository, MovieSearchState } from "./movie-search.types";
import type { IMovieSearchReader } from "./movie-search-reader";

const id = "00000000-0000-4000-8000-000000000001";
const storedCard = { slug: "inception-q25188", title: "Inception", releaseDate: null, releaseYear: 2010, runtimeMinutes: 148,
  posterImageUrl: "https://upload.wikimedia.org/current.jpg",
  posterAttribution: { provider: "commons" as const, rightsKind: "reusable" as const,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Inception.jpg", artist: "Studio", license: "CC0", licenseUrl: null } };
const card = { ...storedCard, posterImageUrl: null, posterAttribution: null };
const fallback = { items: [], total: 91, ranking: { mode: "alphabetical", sourceDate: null, sourceUrl: null, isFresh: false } };
const state = { id: "movies_en", schemaVersion: 2, activeCollection: "movies_en__v2_a1", buildingCollection: null,
  bootstrapPhase: "ready", bootstrapCursor: null, rankingGeneration: 2, rankingReady: true,
  publishedSourceDate: "2026-11-06", repairCursor: null, repairCompletedAt: null, updatedAt: new Date() } satisfies MovieSearchState;
let repo: Record<keyof IMoviesRepository, any>;
let stateRepo: Record<keyof IMovieSearchStateRepository, any>;
let reader: Record<keyof IMovieSearchReader, any>;
let service: MovieCatalogService;
const list = (query = {}) => new ListMoviesHandler(service).handle({ query } as any);
const person = (query = {}) => new GetMoviePersonHandler(service).handle({ params: { wikidataId: "Q25191" }, query } as any);
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
  repo = {
    listPublic: vi.fn().mockResolvedValue(fallback), hydratePublicIds: vi.fn().mockResolvedValue([storedCard]),
    findPublicPersonHeader: vi.fn().mockResolvedValue({ id: "person-uuid", wikidataId: "Q25191", name: "Christopher Nolan" }),
    findPublicPerson: vi.fn().mockResolvedValue({ ...fallback, person: { wikidataId: "Q25191", name: "Christopher Nolan" } }),
  } as unknown as Record<keyof IMoviesRepository, any>;
  stateRepo = { state: vi.fn().mockResolvedValue(state) };
  repo.hydrateCatalogPage = vi.fn().mockResolvedValue({ items: [storedCard], state });
  reader = { search: vi.fn().mockResolvedValue({ ids: [id], total: 22 }) };
  service = new MovieCatalogService(repo, stateRepo, reader);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("movie catalog handlers using the movie index", () => {
  it("uses Typesense for browse and typed search and suppresses poster fields on cards", async () => {
    const browse = await list();
    expect(reader.search).toHaveBeenCalledWith({ page: 1, limit: 21, collection: state.activeCollection, fresh: true, personQid: undefined });
    expect(browse.items).toEqual([card]);
    expect(JSON.stringify(browse.items)).not.toContain("wikimedia.org");
    expect(browse.total).toBe(22); expect(browse.totalPages).toBe(2);
    expect(browse.ranking.mode).toBe("wikipedia_interest");
    await list({ q: " Inception " });
    expect(reader.search).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Inception" }));
    expect(repo.hydrateCatalogPage).toHaveBeenCalledWith([id]);
    expect(stateRepo.state).toHaveBeenCalledTimes(2);
    expect(repo.listPublic).not.toHaveBeenCalled();
  });
  it.each([null, { ...state, rankingReady: false }, { ...state, bootstrapPhase: "replay" },
    { ...state, schemaVersion: 1 }, { ...state, activeCollection: "movies_en__v1_legacy" },
    { ...state, activeCollection: "games_en__123" }])("falls back until an owned publication is ready (%j)", async (publication) => {
    stateRepo.state.mockResolvedValue(publication);
    expect((await list()).total).toBe(91);
    expect(reader.search).not.toHaveBeenCalled();
  });
  it.each([null, new Error("search unavailable")])("falls back after a search outage (%j)", async (result) => {
    result instanceof Error ? reader.search.mockRejectedValue(result) : reader.search.mockResolvedValue(result);
    expect((await list({ q: "film" })).total).toBe(91);
    expect(repo.listPublic).toHaveBeenCalledWith({ page: 1, limit: 21, q: "film" });
  });
  it("falls back if search metadata cannot be read", async () => {
    stateRepo.state.mockRejectedValue(new Error("index state unavailable"));
    expect((await list()).total).toBe(91);
  });
  it.each([{ ...state, rankingReady: false }, { ...state, rankingGeneration: 3 },
    { ...state, activeCollection: "movies_en__v2_b2" }, { ...state, publishedSourceDate: "2026-11-05" }])("rejects readiness changes while searching (%j)", async (after) => {
    repo.hydrateCatalogPage.mockResolvedValue({ items: [storedCard], state: after });
    expect((await list()).total).toBe(91);
  });
  it("keeps a successful zero-match result without falling back", async () => {
    reader.search.mockResolvedValue({ ids: [], total: 0 }); repo.hydrateCatalogPage.mockResolvedValue({ items: [], state });
    expect(await list({ q: "no film" })).toMatchObject({ items: [], total: 0, totalPages: 0 });
    expect(repo.listPublic).not.toHaveBeenCalled();
  });
  it("preserves totals on an out-of-range index page", async () => {
    reader.search.mockResolvedValue({ ids: [], total: 22 }); repo.hydrateCatalogPage.mockResolvedValue({ items: [], state });
    expect(await list({ page: 9 })).toMatchObject({ items: [], total: 22, totalPages: 2 });
    expect(repo.listPublic).not.toHaveBeenCalled();
  });
  it("falls back if an indexed film is deleted or no longer public", async () => {
    repo.hydrateCatalogPage.mockResolvedValue({ items: [], state });
    expect((await list()).total).toBe(91);
  });
  it("falls back if the publication disappears during hydration", async () => {
    repo.hydrateCatalogPage.mockResolvedValue({ items: [], state: null });
    expect((await list()).total).toBe(91);
  });
  it("uses alphabetical index ordering once the source date expires", async () => {
    vi.setSystemTime(new Date("2026-11-14T00:00:00Z"));
    expect((await list()).ranking).toMatchObject({ mode: "alphabetical", isFresh: false });
    expect(reader.search).toHaveBeenCalledWith(expect.objectContaining({ fresh: false }));
  });
  it("uses a person QID filter, page-only role hydration, and the canonical header", async () => {
    repo.hydratePublicIds.mockResolvedValue([{ ...storedCard, roles: ["director", "producer"] }]);
    expect(await person()).toMatchObject({ person: { name: "Christopher Nolan" }, items: [{ ...card, roles: ["director", "producer"] }], total: 22 });
    expect(reader.search).toHaveBeenCalledWith(expect.objectContaining({ personQid: "Q25191" }));
    expect(repo.hydratePublicIds).toHaveBeenCalledWith([id], "person-uuid");
    expect(repo.findPublicPerson).not.toHaveBeenCalled();
  });
  it("falls back when an indexed film no longer belongs to the person", async () => {
    repo.hydratePublicIds.mockResolvedValue([]);
    expect((await person()).total).toBe(91);
    expect(repo.findPublicPerson).toHaveBeenCalledWith("Q25191", { page: 1, limit: 21 });
  });
  it("returns known empty filmographies, while unknown people remain 404", async () => {
    reader.search.mockResolvedValue({ ids: [], total: 0 }); repo.hydratePublicIds.mockResolvedValue([]);
    expect(await person()).toMatchObject({ items: [], total: 0 });
    repo.findPublicPersonHeader.mockResolvedValue(null);
    await expect(person()).rejects.toMatchObject({ statusCode: 404 });
    expect(reader.search).toHaveBeenCalledTimes(1);
  });
});
