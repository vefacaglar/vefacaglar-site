import { describe, expect, it, vi } from "vitest";
import { contentHref, loadContentList, parseContentQuery, type ContentItem, type ContentQuery } from "./content-list";

const state: ContentQuery = { type: "posts", query: "", status: "", page: 1, limit: 10 };
const item = (id: number, title = `Post ${id}`): ContentItem => ({
  id: String(id), title, slug: `post-${id}`, status: "draft",
  createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z",
});

describe("Content query state", () => {
  it("reads only the active type's state and normalizes invalid inputs", () => {
    expect(parseContentQuery({ content: "projects", projectsQuery: "  APP  ", projectsStatus: "published", projectsPage: "2", projectsLimit: "50", postsPage: "9" }))
      .toEqual({ type: "projects", query: "APP", status: "published", page: 2, limit: 50 });
    expect(parseContentQuery({ content: "invented", postsPage: "-1", postsLimit: "1000", postsStatus: "other" })).toEqual(state);
    expect(parseContentQuery({ postsPage: "1.5", postsQuery: ["a", "b"] })).toEqual(state);
  });

  it("preserves each tab's state and resets only the active page when filters change", () => {
    const url = contentHref("content=posts&postsPage=7&projectsPage=3&projectsStatus=draft", "posts", { query: "C++ & API", limit: 50 });
    const params = new URL(url, "https://example.test").searchParams;
    expect(params.get("postsQuery")).toBe("C++ & API");
    expect(params.get("postsPage")).toBe("1");
    expect(params.get("postsLimit")).toBe("50");
    expect(params.get("projectsPage")).toBe("3");
    expect(params.get("projectsStatus")).toBe("draft");
    expect(new URL(contentHref(params.toString(), "projects"), "https://example.test").searchParams.get("projectsPage")).toBe("3");
    const cleared = new URL(contentHref(params.toString(), "posts", { query: "", status: "" }), "https://example.test").searchParams;
    expect(cleared.has("postsQuery")).toBe(false);
    expect(cleared.has("postsStatus")).toBe(false);
  });
});

describe("Content listing", () => {
  it("requests just the visible API page when not searching", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [item(21)], total: 21, totalPages: 3 });
    expect(await loadContentList({ ...state, page: 3 }, fetchPage)).toMatchObject({ page: 3, total: 21, items: [item(21)] });
    expect(fetchPage.mock.calls).toEqual([[3, 10]]);
  });

  it("recovers the last valid page after the last row on a page is deleted", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [], total: 10, totalPages: 1 })
      .mockResolvedValueOnce({ items: [item(1)], total: 10, totalPages: 1 });
    expect(await loadContentList({ ...state, page: 2 }, fetchPage)).toMatchObject({ page: 1, items: [item(1)] });
    expect(fetchPage.mock.calls).toEqual([[2, 10], [1, 10]]);
  });

  it("finds case-insensitive title/slug matches beyond 1000 rows and paginates matches", async () => {
    const rows = Array.from({ length: 1005 }, (_, index) => item(index + 1, index >= 995 ? `Needle ${index}` : "Other"));
    rows.push({ ...item(1006), slug: "needle-in-slug" });
    const fetchPage = vi.fn(async (page: number, limit: number) => ({ items: rows.slice((page - 1) * limit, page * limit), total: rows.length, totalPages: Math.ceil(rows.length / limit) }));
    const result = await loadContentList({ ...state, query: "NEEDLE", page: 2 }, fetchPage);
    expect(result).toMatchObject({ total: 11, totalPages: 2, page: 2 });
    expect(result.items.map((row) => row.id)).toEqual(["1006"]);
    expect(fetchPage.mock.calls).toEqual([[1, 1000], [2, 1000]]);
  });

  it("returns a usable first page for an empty search and propagates failed batches", async () => {
    const empty = vi.fn().mockResolvedValue({ items: [item(1)], total: 1, totalPages: 1 });
    expect(await loadContentList({ ...state, query: "missing", page: 9 }, empty)).toEqual({ items: [], total: 0, totalPages: 0, page: 1 });
    const failed = vi.fn().mockResolvedValueOnce({ items: [item(1)], total: 1001, totalPages: 2 }).mockRejectedValueOnce(new Error("Unavailable"));
    await expect(loadContentList({ ...state, query: "post" }, failed)).rejects.toThrow("Unavailable");
  });
});
