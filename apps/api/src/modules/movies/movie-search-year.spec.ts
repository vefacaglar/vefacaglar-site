import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { splitMovieYearQuery } from "./movie-search-year";

const now = new Date("2026-11-15T12:00:00Z");

describe("splitMovieYearQuery", () => {
  it("splits title words from a trailing or leading release year", () => {
    expect(splitMovieYearQuery("rango 2011", now)).toEqual({ words: "rango", year: 2011 });
    expect(splitMovieYearQuery("  2011   Rango ", now)).toEqual({ words: "Rango", year: 2011 });
    expect(splitMovieYearQuery("the thing (1982)", now)).toEqual({ words: "the thing", year: 1982 });
  });
  it("uses the last year token and keeps earlier ones as title words", () => {
    expect(splitMovieYearQuery("2001 a space odyssey 1968", now)).toEqual({ words: "2001 a space odyssey", year: 1968 });
    expect(splitMovieYearQuery("1917 2019", now)).toEqual({ words: "1917", year: 2019 });
  });
  it("keeps a year-only query as a title search", () => {
    expect(splitMovieYearQuery("1917", now)).toBeNull();
    expect(splitMovieYearQuery(" (2012) ", now)).toBeNull();
    expect(splitMovieYearQuery("2012 ***", now)).toBeNull();
  });
  it("ignores numbers outside the film-year range or not four digits", () => {
    expect(splitMovieYearQuery("blade runner 2049", now)).toBeNull();
    expect(splitMovieYearQuery("film 1869", now)).toBeNull();
    expect(splitMovieYearQuery("upcoming 2031", now)).toEqual({ words: "upcoming", year: 2031 });
    expect(splitMovieYearQuery("apollo 13", now)).toBeNull();
    expect(splitMovieYearQuery("rango 20110", now)).toBeNull();
    expect(splitMovieYearQuery("rango2011", now)).toBeNull();
  });
  it("returns null for blank input", () => {
    expect(splitMovieYearQuery(undefined, now)).toBeNull();
    expect(splitMovieYearQuery("   ", now)).toBeNull();
  });
});
