import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));

import { httpClient } from "./httpClient";
import { getMovie, getMoviePerson, getMovieRankingNotice, getPublicMovies, moviePageNumber, moviePersonHref } from "./movies";

beforeEach(() => vi.resetAllMocks());

describe("movie data requests", () => {
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
  it("loads a stable person identity and keeps the requested filmography page", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify({ person: { wikidataId: "Q25191", name: "Christopher Nolan" }, items: [] }), { status: 200 }));
    expect(await getMoviePerson("Q25191", 2)).toMatchObject({ person: { wikidataId: "Q25191" }, items: [] });
    expect(httpClient.get).toHaveBeenCalledWith("/api/movies/people/Q25191?page=2&limit=21");
  });
  it("keeps missing people separate from upstream failures", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await getMoviePerson("Q999", 1)).toBeNull();
    vi.mocked(httpClient.get).mockResolvedValueOnce(new Response(null, { status: 502 }));
    await expect(getMoviePerson("Q25191", 1)).rejects.toThrow("502");
  });
  it("rejects malformed person identities without a network request", async () => {
    for (const id of ["Q0", "q123", "person-name", "Q123/other", "Q123?admin=true"]) {
      expect(await getMoviePerson(id, 1)).toBeNull();
    }
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});

describe("movie person navigation", () => {
  it("uses the stable ID and safely encodes it as a single route segment", () => {
    expect(moviePersonHref("Q25191")).toBe("/movies/people/Q25191");
    expect(moviePersonHref("a/b?c")).toBe("/movies/people/a%2Fb%3Fc");
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
