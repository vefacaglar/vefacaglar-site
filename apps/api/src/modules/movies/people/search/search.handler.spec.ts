import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchMoviePeopleHandler } from "./search.handler";
import type { IMovieCatalogService } from "../../search/movie-catalog.service";
import type { IMoviesRepository } from "../../movies.repository.interface";
import { MoviePeopleSearchService } from "../../search/movie-people-search.service";
import type { IMoviePeopleSearchReader } from "../../search/movie-people-search-reader";
import type { IMoviePeopleSearchStateRepository, MoviePeopleSearchState } from "../../search/movie-search.types";

const nolanId = "00000000-0000-4000-8000-000000000001";
const caineId = "00000000-0000-4000-8000-000000000002";
const nolan = { wikidataId: "Q25191", name: "Christopher Nolan", roles: ["director", "producer"] as ("director" | "producer")[],
  knownFor: { slug: "inception-q25188", title: "Inception", releaseYear: 2010 } };
const caine = { wikidataId: "Q123166", name: "Michael Caine", roles: ["cast"] as "cast"[], knownFor: null };
const state = { id: "movie_people_en", schemaVersion: 2, activeCollection: "movie_people_en", buildingCollection: null,
  buildCursor: null, buildStartedAt: null, publishedAt: new Date(), updatedAt: new Date() } satisfies MoviePeopleSearchState;

let repo: Record<keyof IMoviesRepository, any>;
let stateRepo: Record<keyof IMoviePeopleSearchStateRepository, any>;
let reader: Record<keyof IMoviePeopleSearchReader, any>;
let catalog: Record<keyof IMovieCatalogService, any>;
const search = (query: Record<string, unknown>) =>
  new SearchMoviePeopleHandler(new MoviePeopleSearchService(repo, stateRepo, reader), catalog).handle({ query } as any);

beforeEach(() => {
  catalog = { listPublic: vi.fn().mockResolvedValue({ items: [], total: 0 }), findPublicPerson: vi.fn() };
  repo = { searchPublicPeople: vi.fn().mockResolvedValue([nolan]), hydratePublicPeople: vi.fn().mockResolvedValue([caine, nolan]) } as unknown as Record<keyof IMoviesRepository, any>;
  stateRepo = { state: vi.fn().mockResolvedValue(state) };
  reader = { search: vi.fn().mockResolvedValue({ ids: [caineId, nolanId] }) };
});

describe("public movie people search handler", () => {
  it("uses the Meilisearch people index and hydrates hits in index order", async () => {
    expect(await search({ q: "  chris nol " })).toEqual({ items: [caine, nolan], order: ["people", "movies"] });
    expect(reader.search).toHaveBeenCalledWith({ collection: "movie_people_en", q: "chris nol", limit: 12 });
    expect(repo.hydratePublicPeople).toHaveBeenCalledWith([caineId, nolanId]);
    expect(repo.searchPublicPeople).not.toHaveBeenCalled();
  });
  it("keeps an empty index answer without querying SQL", async () => {
    reader.search.mockResolvedValue({ ids: [] });
    expect(await search({ q: "zzzz", limit: 4 })).toEqual({ items: [], order: ["people", "movies"] });
    expect(repo.hydratePublicPeople).not.toHaveBeenCalled();
    expect(repo.searchPublicPeople).not.toHaveBeenCalled();
  });
  it("falls back to SQL when the index is unavailable", async () => {
    reader.search.mockResolvedValue(null);
    expect(await search({ q: "nolan", limit: 4 })).toEqual({ items: [nolan], order: ["people", "movies"] });
    expect(repo.searchPublicPeople).toHaveBeenCalledWith("nolan", 4);
  });
  it.each([null, { ...state, activeCollection: null }, { ...state, schemaVersion: 1 },
    { ...state, activeCollection: "movie_people_en__v1_a1" }, { ...state, activeCollection: "movies_en" }])("falls back to SQL until an owned people index is published (%j)", async (publication) => {
    stateRepo.state.mockResolvedValue(publication);
    expect(await search({ q: "nolan" })).toEqual({ items: [nolan], order: ["people", "movies"] });
    expect(reader.search).not.toHaveBeenCalled();
    expect(repo.searchPublicPeople).toHaveBeenCalledWith("nolan", 12);
  });
  it("falls back to SQL when an indexed person is no longer public", async () => {
    repo.hydratePublicPeople.mockResolvedValue([nolan]);
    expect(await search({ q: "nolan" })).toEqual({ items: [nolan], order: ["people", "movies"] });
    expect(repo.searchPublicPeople).toHaveBeenCalledWith("nolan", 12);
  });
  it.each(["state", "hydrate"])("falls back to SQL when index %s lookup fails", async (step) => {
    (step === "state" ? stateRepo.state : repo.hydratePublicPeople).mockRejectedValue(new Error("unavailable"));
    expect(await search({ q: "nolan" })).toEqual({ items: [nolan], order: ["people", "movies"] });
  });
  it.each([undefined, "", "   ", "!?-"])("returns no people for blank or punctuation-only input (%j)", async (q) => {
    expect(await search({ q })).toEqual({ items: [], order: ["people", "movies"] });
    expect(stateRepo.state).not.toHaveBeenCalled();
    expect(repo.searchPublicPeople).not.toHaveBeenCalled();
  });
  it("propagates SQL fallback failures", async () => {
    reader.search.mockResolvedValue(null);
    repo.searchPublicPeople.mockRejectedValue(new Error("Database unavailable"));
    await expect(search({ q: "nolan" })).rejects.toThrow("Database unavailable");
  });
  describe("section order", () => {
    beforeEach(() => reader.search.mockResolvedValue(null));
    const people = (...names: string[]) => names.map((name, i) => ({ wikidataId: `Q${i + 1}`, name, roles: ["cast" as const], knownFor: null }));
    const titles = (...names: string[]) => ({ items: names.map((title) => ({ title })), total: names.length });
    it("puts people first when a person matches best (megan)", async () => {
      repo.searchPublicPeople.mockResolvedValue(people("Megan Fox"));
      catalog.listPublic.mockResolvedValue(titles("Megan Leavey Story Part Two"));
      expect((await search({ q: "megan" })).order).toEqual(["people", "movies"]);
      expect(catalog.listPublic).toHaveBeenCalledWith({ page: 1, limit: 5, q: "megan" });
    });
    it("puts titles first when a title matches best (cargo)", async () => {
      repo.searchPublicPeople.mockResolvedValue(people("Cargo Smith Jones"));
      catalog.listPublic.mockResolvedValue(titles("Cargo"));
      expect((await search({ q: "cargo" })).order).toEqual(["movies", "people"]);
    });
    it("keeps the tie order instead of failing when the title lookup fails", async () => {
      catalog.listPublic.mockRejectedValue(new Error("down"));
      expect((await search({ q: "cargo" })).order).toEqual(["people", "movies"]);
    });
    it("does not query titles for blank input", async () => {
      await search({ q: "  " });
      expect(catalog.listPublic).not.toHaveBeenCalled();
    });
  });
});
