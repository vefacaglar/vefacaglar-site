import { describe, expect, it, vi } from "vitest";
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));
import { communityPageHref, communityPageNumber } from "./community";

describe("community pagination", () => {
  it("accepts positive page numbers only", () => {
    expect(communityPageNumber("3")).toBe(3);
    for (const page of [undefined, "0", "-1", "2.5", "1000001", "Infinity", "x"]) expect(communityPageNumber(page)).toBe(1);
  });
  it("preserves other detail-page state and resets the first-page query", () => {
    expect(communityPageHref("/explore/movies/film", { watchPage: "2", lang: "tr", communityPage: "4" }, 3))
      .toBe("/explore/movies/film?watchPage=2&lang=tr&communityPage=3#community");
    expect(communityPageHref("/explore/movies/film", { watchPage: "2", communityPage: "4" }, 1))
      .toBe("/explore/movies/film?watchPage=2#community");
  });
});
