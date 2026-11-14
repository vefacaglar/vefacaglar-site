import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));

import { httpClient } from "./httpClient";
import { gameCompanyHref } from "./gameCompanies";
import {
  gameCompanyGroupHref,
  gameSearchTerm,
  gameSuggestionOptions,
  parseGameSuggestions,
} from "./gameSearch";
import { fetchGameSuggestions, getGameSearchCompanies } from "./gameSearchApi";

beforeEach(() => vi.resetAllMocks());

const response = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("gameSearchTerm", () => {
  it("normalizes whitespace and rejects blank or punctuation-only input", () => {
    expect(gameSearchTerm("  half   life ")).toBe("half life");
    expect(gameSearchTerm("Şirket")).toBe("Şirket");
    expect(gameSearchTerm("   ")).toBeNull();
    expect(gameSearchTerm("?!-")).toBeNull();
    expect(gameSearchTerm(null)).toBeNull();
    expect(gameSearchTerm("x".repeat(150))).toHaveLength(100);
  });
});

describe("gameSuggestionOptions", () => {
  it("orders developers, publishers, then games and builds unlocalized hrefs", () => {
    const company = { name: "Studio", slug: "studio", gameCount: 2 };
    const options = gameSuggestionOptions({
      games: [{ slug: "doom", title: "Doom", releaseYear: 1993, developer: "id Software" }],
      publishers: [company],
      developers: [company],
    });
    expect(options.map((option) => [option.key, option.href])).toEqual([
      ["developers:studio", "/explore/games/developers/studio"],
      ["publishers:studio", "/explore/games/publishers/studio"],
      ["games:doom", "/explore/games/doom"],
    ]);
  });

  it("matches the company page routes", () => {
    expect(gameCompanyGroupHref("developers", "a/b")).toBe(gameCompanyHref("developer", "a/b"));
    expect(gameCompanyGroupHref("publishers", "a/b")).toBe(gameCompanyHref("publisher", "a/b"));
  });

  it("degrades malformed responses to empty groups", () => {
    expect(parseGameSuggestions(null)).toEqual({ developers: [], publishers: [], games: [] });
    expect(parseGameSuggestions({ games: "nope", developers: [] })).toEqual({ developers: [], publishers: [], games: [] });
  });
});

describe("game search API", () => {
  it("skips the API for unsearchable input", async () => {
    expect(await fetchGameSuggestions("  ")).toEqual({ developers: [], publishers: [], games: [] });
    expect(await getGameSearchCompanies("--")).toEqual({ developers: [], publishers: [] });
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it("requests suggestions with an encoded, normalized term", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(response({ developers: [], publishers: [], games: [] }));
    await fetchGameSuggestions(" a&b  c ");
    expect(httpClient.get).toHaveBeenCalledWith("/api/games/search/suggest?q=a%26b+c", { signal: undefined });
  });

  it("throws on suggestion failures so the proxy can report them", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(response({}, 500));
    await expect(fetchGameSuggestions("doom")).rejects.toThrow("500");
  });

  it("hides company sections when the API fails", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(response({}, 503));
    expect(await getGameSearchCompanies("sony")).toEqual({ developers: [], publishers: [] });
    vi.mocked(httpClient.get).mockRejectedValue(new Error("down"));
    expect(await getGameSearchCompanies("sony")).toEqual({ developers: [], publishers: [] });
  });

  it("returns only the company groups", async () => {
    const company = { name: "Sony", slug: "sony", gameCount: 3 };
    vi.mocked(httpClient.get).mockResolvedValue(response({ developers: [company], publishers: [], games: [{}] }));
    expect(await getGameSearchCompanies("sony")).toEqual({ developers: [company], publishers: [] });
    expect(httpClient.get).toHaveBeenCalledWith("/api/games/search/companies?q=sony&limit=12");
  });
});
