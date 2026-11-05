import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));

import { httpClient } from "./httpClient";
import { getMovie, getPublicMovies } from "./movies";

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
});
