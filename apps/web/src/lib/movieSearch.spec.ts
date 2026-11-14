import { describe, expect, it } from "vitest";
import { moviePersonKnownFor, movieSearchOptions, movieSuggestTerm, nextMovieOptionIndex, parseMovieSuggestions } from "./movieSearch";

const roleLabels = { cast: "Cast", director: "Director", producer: "Producer" };
const nolan = { wikidataId: "Q25191", name: "Christopher Nolan", roles: ["director", "producer"] as ("director" | "producer")[],
  knownFor: { slug: "inception-q25188", title: "Inception", releaseYear: 2010 } };

describe("movie search helpers", () => {
  it("only searches trimmed terms with two or more characters and a letter or digit", () => {
    expect(movieSuggestTerm("  in  ")).toBe("in");
    expect(movieSuggestTerm("a")).toBeNull();
    expect(movieSuggestTerm(" a ")).toBeNull();
    expect(movieSuggestTerm("?!")).toBeNull();
    expect(movieSuggestTerm(null)).toBeNull();
    expect(movieSuggestTerm("x".repeat(200))).toHaveLength(140);
  });
  it("builds a short known-for line, tolerating missing films and years", () => {
    expect(moviePersonKnownFor(nolan, roleLabels)).toBe("Director · Producer · Inception (2010)");
    expect(moviePersonKnownFor({ ...nolan, knownFor: { ...nolan.knownFor, releaseYear: null } }, roleLabels)).toBe("Director · Producer · Inception");
    expect(moviePersonKnownFor({ ...nolan, roles: ["cast"], knownFor: null }, roleLabels)).toBe("Cast");
  });
  it("orders titles before people and links to movie and person pages", () => {
    const options = movieSearchOptions({
      movies: [{ slug: "inception-q25188", title: "Inception", releaseYear: 2010, director: "Christopher Nolan" },
        { slug: "untitled-q1", title: "Untitled", releaseYear: null, director: null }],
      people: [nolan],
    }, roleLabels);
    expect(options.map(({ kind, href, label, detail }) => ({ kind, href, label, detail }))).toEqual([
      { kind: "movie", href: "/explore/movies/inception-q25188", label: "Inception", detail: "2010 · Christopher Nolan" },
      { kind: "movie", href: "/explore/movies/untitled-q1", label: "Untitled", detail: "" },
      { kind: "person", href: "/explore/movies/people/Q25191", label: "Christopher Nolan", detail: "Director · Producer · Inception (2010)" },
    ]);
  });
  it("follows the response's group order, so the keyboard walks groups as they are rendered", () => {
    const data = { movies: [{ slug: "megan-leavey-q1", title: "Megan Leavey", releaseYear: 2017, director: null }],
      people: [{ ...nolan, wikidataId: "Q80069", name: "Megan Fox" }] };
    expect(movieSearchOptions({ ...data, order: ["people", "movies"] }, roleLabels).map((option) => option.kind)).toEqual(["person", "movie"]);
    expect(movieSearchOptions({ ...data, order: ["movies", "people"] }, roleLabels).map((option) => option.kind)).toEqual(["movie", "person"]);
  });
  it("parses suggestions, defaulting to titles first when the group order is missing or malformed", () => {
    expect(parseMovieSuggestions(null)).toEqual({ movies: [], people: [], order: ["movies", "people"] });
    expect(parseMovieSuggestions({ movies: "x", people: [nolan], order: ["people", "movies"] }))
      .toEqual({ movies: [], people: [nolan], order: ["people", "movies"] });
    for (const order of [undefined, ["people"], ["people", "people"], ["people", "games"]]) {
      expect(parseMovieSuggestions({ order }).order).toEqual(["movies", "people"]);
    }
  });
  it("moves the highlight through the options and back to the input at either end", () => {
    expect(nextMovieOptionIndex(-1, 3, 1)).toBe(0);
    expect(nextMovieOptionIndex(-1, 3, -1)).toBe(2);
    expect(nextMovieOptionIndex(1, 3, 1)).toBe(2);
    expect(nextMovieOptionIndex(2, 3, 1)).toBe(-1);
    expect(nextMovieOptionIndex(0, 3, -1)).toBe(-1);
    expect(nextMovieOptionIndex(0, 0, 1)).toBe(-1);
  });
});
