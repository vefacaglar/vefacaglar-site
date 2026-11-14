import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { SuggestMoviesHandler } from "./suggest.handler";
import type { IMoviesRepository } from "../movies.repository.interface";
import type { IMovieCatalogService } from "../search/movie-catalog.service";
import type { IMoviePeopleSearchService } from "../search/movie-people-search.service";

const ranking = { mode: "alphabetical", sourceDate: null, sourceUrl: null, isFresh: false };
const card = (slug: string, title: string, releaseYear: number | null) => ({ slug, title, releaseDate: "2010-07-16", releaseYear, runtimeMinutes: 148,
  posterImageUrl: "https://upload.wikimedia.org/poster.jpg",
  posterAttribution: { sourceUrl: "https://commons.wikimedia.org/wiki/File:P.jpg", artist: null, license: "CC0", licenseUrl: null } });
const nolan = { wikidataId: "Q25191", name: "Christopher Nolan", roles: ["director", "producer"] as ("director" | "producer")[],
  knownFor: { slug: "inception-q25188", title: "Inception", releaseYear: 2010 } };

function setup(items = [card("inception-q25188", "Inception", 2010), card("insomnia-q1", "Insomnia", null)]) {
  const catalog = { listPublic: vi.fn().mockResolvedValue({ items, total: items.length, ranking }), findPublicPerson: vi.fn() } as Record<keyof IMovieCatalogService, any>;
  const people = { searchPublicPeople: vi.fn().mockResolvedValue([nolan]) } as Record<keyof IMoviePeopleSearchService, any>;
  const repo = {
    findDirectorNames: vi.fn().mockResolvedValue({ "inception-q25188": "Christopher Nolan" }),
  } as unknown as Record<keyof IMoviesRepository, any>;
  return { catalog, people, repo, handler: new SuggestMoviesHandler(catalog, people, repo) };
}

describe("movie search suggestions handler", () => {
  it("returns five-at-most text-only titles with directors, plus matching people", async () => {
    const { catalog, people, repo, handler } = setup();
    const result = await handler.handle({ query: { q: " in " } } as any);
    expect(catalog.listPublic).toHaveBeenCalledWith({ page: 1, limit: 5, q: "in" });
    expect(people.searchPublicPeople).toHaveBeenCalledWith("in", 5);
    expect(repo.findDirectorNames).toHaveBeenCalledWith(["inception-q25188", "insomnia-q1"]);
    expect(result).toEqual({
      movies: [
        { slug: "inception-q25188", title: "Inception", releaseYear: 2010, director: "Christopher Nolan" },
        { slug: "insomnia-q1", title: "Insomnia", releaseYear: null, director: null },
      ],
      people: [nolan],
    });
    expect(JSON.stringify(result)).not.toContain("wikimedia.org");
  });
  it("caps an oversized catalog page at the suggestion limit", async () => {
    const { repo, handler } = setup(Array.from({ length: 7 }, (_, i) => card(`film-${i}`, `Film ${i}`, 2000 + i)));
    expect((await handler.handle({ query: { q: "film" } } as any)).movies).toHaveLength(5);
    expect(repo.findDirectorNames.mock.calls[0][0]).toHaveLength(5);
  });
  it("skips the director lookup when no titles match", async () => {
    const { repo, handler } = setup([]);
    expect(await handler.handle({ query: { q: "nolan" } } as any)).toEqual({ movies: [], people: [nolan] });
    expect(repo.findDirectorNames).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "  ", "&&!"])("ignores blank or punctuation-only input (%j)", async (q) => {
    const { catalog, people, handler } = setup();
    expect(await handler.handle({ query: { q } } as any)).toEqual({ movies: [], people: [] });
    expect(catalog.listPublic).not.toHaveBeenCalled();
    expect(people.searchPublicPeople).not.toHaveBeenCalled();
  });
  it("propagates failures instead of returning partial suggestions", async () => {
    const { people, handler } = setup();
    people.searchPublicPeople.mockRejectedValue(new Error("Database unavailable"));
    await expect(handler.handle({ query: { q: "nolan" } } as any)).rejects.toThrow("Database unavailable");
  });
});
