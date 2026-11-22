import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));

import { httpClient } from "./httpClient";
import { getMovie, getMovieSuggestions, getMoviePerson, getMovieAudienceSources, getMovieRankingNotice, getPublicMovies, moviePageNumber, moviePersonHref, searchMoviePeople } from "./movies";

beforeEach(() => vi.resetAllMocks());

describe("movie data requests", () => {
  it("requests typeahead suggestions with an encoded term and forwards the abort signal", async () => {
    const data = { movies: [], people: [] };
    vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    const signal = new AbortController().signal;
    expect(await getMovieSuggestions("Love & War", { signal })).toEqual(data);
    expect(httpClient.get).toHaveBeenCalledWith("/api/movies/suggest?q=Love+%26+War", { signal });
  });
  it("requests the people results section with a fixed limit", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    expect(await searchMoviePeople("Chris Nolan")).toEqual({ items: [], order: ["people", "movies"] });
    expect(httpClient.get).toHaveBeenCalledWith("/api/movies/people?q=Chris+Nolan&limit=12");
  });
  it("carries the API's section order and falls back to people first when it is missing or invalid", async () => {
    const get = (order: unknown) => vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify({ items: [], order }), { status: 200 }));
    get(["movies", "people"]);
    expect((await searchMoviePeople("cargo"))?.order).toEqual(["movies", "people"]);
    get(["movies", "movies"]);
    expect((await searchMoviePeople("cargo"))?.order).toEqual(["people", "movies"]);
  });
  it("surfaces upstream failures for people and suggestions", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(null, { status: 503 }));
    await expect(searchMoviePeople("nolan")).rejects.toThrow("503");
    await expect(getMovieSuggestions("nolan")).rejects.toThrow("503");
  });
  it("requests 21 results and safely encodes the search term", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await getPublicMovies(2, "Love & War");
    expect(httpClient.get).toHaveBeenCalledWith("/api/movies?page=2&limit=21&q=Love+%26+War");
  });
  it("preserves a real missing movie as null", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(null, { status: 404 }));
    expect(await getMovie("missing")).toBeNull();
  });
  it("throws an upstream failure instead of making it a missing movie", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getMovie("the-godfather-q47703")).rejects.toThrow("503");
  });
  it("encodes detail slugs as one URL component", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(null, { status: 404 }));
    await getMovie("a/b?c");
    expect(httpClient.get).toHaveBeenCalledWith("/api/movies/a%2Fb%3Fc");
  });
  it("loads a stable person identity and loads the whole filmography without paging params", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify({ person: { wikidataId: "Q25191", name: "Christopher Nolan" }, items: [] }), { status: 200 }));
    expect(await getMoviePerson("Q25191")).toMatchObject({ person: { wikidataId: "Q25191" }, items: [] });
    expect(httpClient.get).toHaveBeenCalledWith("/api/movies/people/Q25191");
  });
  it("keeps missing people separate from upstream failures", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await getMoviePerson("Q999")).toBeNull();
    vi.mocked(httpClient.get).mockResolvedValueOnce(new Response(null, { status: 502 }));
    await expect(getMoviePerson("Q25191")).rejects.toThrow("502");
  });
  it("rejects malformed person identities without a network request", async () => {
    for (const id of ["Q0", "q123", "person-name", "Q123/other", "Q123?admin=true"]) {
      expect(await getMoviePerson(id)).toBeNull();
    }
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});

describe("movie person navigation", () => {
  it("uses the stable ID and safely encodes it as a single route segment", () => {
    expect(moviePersonHref("Q25191")).toBe("/explore/movies/people/Q25191");
    expect(moviePersonHref("a/b?c")).toBe("/explore/movies/people/a%2Fb%3Fc");
  });

  it("accepts positive page numbers and safely resets malformed page input", () => {
    expect(moviePageNumber("2")).toBe(2);
    for (const input of [undefined, "0", "-1", "1.5", "Infinity", "NaN", "9007199254740992"]) {
      expect(moviePageNumber(input)).toBe(1);
    }
  });
});

describe("movie ranking source notice", () => {
  const ranking = {
    mode: "wikipedia_interest" as const,
    sourceDate: "2026-11-04",
    sourceUrl: "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/2026/11/04",
    isFresh: true,
  };

  it("describes the actual fresh source day and links to its observation", () => {
    expect(getMovieRankingNotice(ranking)).toEqual({
      date: "4 November 2026",
      sourceUrl: ranking.sourceUrl,
    });
  });

  it("formats a ranking date in Turkish when requested", () => {
    expect(getMovieRankingNotice(ranking, "tr")?.date).toBe("4 Kasım 2026");
  });

  it("does not imply an observation for missing, stale, or invalid metadata", () => {
    expect(getMovieRankingNotice(undefined)).toBeNull();
    expect(getMovieRankingNotice({ ...ranking, isFresh: false })).toBeNull();
    expect(getMovieRankingNotice({ ...ranking, mode: "alphabetical" })).toBeNull();
    expect(getMovieRankingNotice({ ...ranking, sourceDate: "2026-02-29" })).toBeNull();
    expect(getMovieRankingNotice({ ...ranking, sourceDate: "2026-11-04T12:00:00Z" })).toBeNull();
  });

  it("uses official documentation when the response contains an unsafe or absent URL", () => {
    const expected = "https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html";
    for (const sourceUrl of [null, "javascript:alert(1)", "https://wikimedia.org.evil.example/", "https://user:pass@wikimedia.org/api/rest_v1/metrics/pageviews/foo"]) {
      expect(getMovieRankingNotice({ ...ranking, sourceUrl })?.sourceUrl).toBe(expected);
    }
  });
});


describe("current movie audience source notices", () => {
  const source = { provider: "tmdb" as const, sourceDate: "2026-11-22", windowStart: "2026-11-22",
    expiresAt: "2026-11-25T00:00:00Z", sourceUrl: "javascript:unsafe", observedCount: 500, matchedCount: 438 };
  const ranking = { mode: "combined_popularity" as const, sourceDate: "2026-11-22", sourceUrl: null, isFresh: true, sources: [source] };
  it("uses canonical source links and shows the actual date window", () => {
    expect(getMovieAudienceSources(ranking)).toEqual([{ provider: "tmdb", label: "TMDB popularity",
      href: "https://developer.themoviedb.org/docs/daily-id-exports", window: "2026-11-22" }]);
    expect(getMovieAudienceSources({ ...ranking, sources: [{ ...source, provider: "netflix", windowStart: "2026-11-09", sourceDate: "2026-11-15" }] })[0])
      .toMatchObject({ label: "Netflix film views", window: "2026-11-09–2026-11-15" });
  });
  it("suppresses stale, unmatched and malformed source notices", () => {
    expect(getMovieAudienceSources({ ...ranking, isFresh: false })).toEqual([]);
    expect(getMovieAudienceSources({ ...ranking, sources: [{ ...source, matchedCount: 0 }] })).toEqual([]);
    expect(getMovieAudienceSources({ ...ranking, sources: [{ ...source, sourceDate: "2026-02-29" }] })).toEqual([]);
    expect(getMovieAudienceSources(undefined)).toEqual([]);
  });
});
