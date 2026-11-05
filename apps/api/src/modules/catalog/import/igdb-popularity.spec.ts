import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { parsePopularityPage, POPULARITY_PAGE_SIZE, readPopularityPages } from "./igdb-popularity";

const types = [1, 3, 5];
const row = (id: number, patch: Record<string, unknown> = {}) => ({ id, game_id: 999, popularity_type: 1, value: 10, calculated_at: 1_793_491_200, ...patch });
const fullPage = () => Array.from({ length: POPULARITY_PAGE_SIZE }, (_, index) => row(index + 1));

describe("IGDB global popularity pagination", () => {
  it("advances by raw primitive id even when an entire page belongs to games outside the catalog", async () => {
    const load = vi.fn().mockResolvedValueOnce(fullPage()).mockResolvedValueOnce([row(501, { game_id: 1 })]);
    const primitives = await readPopularityPages(types, load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[0][0]).toContain("id > 0; sort id asc; limit 500");
    expect(load.mock.calls[1][0]).toContain("id > 500; sort id asc; limit 500");
    // The caller filters catalog ids only after the complete provider walk.
    expect(primitives.filter((primitive) => primitive.igdbId === 1)).toEqual([
      expect.objectContaining({ igdbId: 1, popularityType: 1, value: 10 }),
    ]);
    expect(primitives).toHaveLength(501);
  });

  it("fetches an empty terminal page after a full page and does not repeat its rows", async () => {
    const load = vi.fn().mockResolvedValueOnce(fullPage()).mockResolvedValueOnce([]);
    await expect(readPopularityPages(types, load)).resolves.toHaveLength(500);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("stops on a short raw page, independently of the eventual catalog matches", async () => {
    const load = vi.fn().mockResolvedValue([row(2000), row(3000)]);
    await expect(readPopularityPages(types, load)).resolves.toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("fails on a globally empty response instead of returning a destructive empty refresh", async () => {
    await expect(readPopularityPages(types, vi.fn().mockResolvedValue([]))).rejects.toThrow("no current popularity data");
  });

  it("does not return partially accumulated data after a later page fails", async () => {
    const load = vi.fn().mockResolvedValueOnce(fullPage()).mockRejectedValueOnce(new Error("provider failed"));
    await expect(readPopularityPages(types, load)).rejects.toThrow("provider failed");
  });

  it("rejects a later non-advancing page instead of looping or returning partial data", async () => {
    const load = vi.fn().mockResolvedValueOnce(fullPage()).mockResolvedValueOnce([row(500)]);
    await expect(readPopularityPages(types, load)).rejects.toThrow("non-advancing");
  });

  it("validates type ids before forming a provider query", async () => {
    const load = vi.fn();
    await expect(readPopularityPages([Number.NaN], load)).rejects.toThrow("Invalid IGDB popularity types");
    expect(load).not.toHaveBeenCalled();
  });
});

describe("IGDB popularity page validation", () => {
  it.each([
    {},
    [row(1), row(1)],
    [row(2), row(1)],
    [row(0)],
    [row(1, { game_id: 0 })],
    [row(1, { game_id: "1" })],
    [row(1, { popularity_type: 4 })],
    [row(1, { value: -1 })],
    [row(1, { value: Number.NaN })],
    [row(1, { value: Number.POSITIVE_INFINITY })],
    [row(1, { calculated_at: "today" })],
    [row(1, { calculated_at: -1 })],
    [row(1, { calculated_at: Number.MAX_SAFE_INTEGER })],
  ].map((raw) => ({ raw })))("rejects malformed response $raw", ({ raw }) => {
    expect(() => parsePopularityPage(raw, 0, types)).toThrow();
  });

  it("does not accept an oversized response or an invalid cursor", () => {
    expect(() => parsePopularityPage([...fullPage(), row(501)], 0, types)).toThrow("invalid popularity page");
    expect(() => parsePopularityPage([], -1, types)).toThrow("invalid popularity page");
  });

  it("keeps real zero measurements and missing calculation times distinct", () => {
    const parsed = parsePopularityPage([row(4, { value: 0, calculated_at: null }), row(5)], 3, types);
    expect(parsed.nextId).toBe(5);
    expect(parsed.done).toBe(true);
    expect(parsed.primitives[0]).toMatchObject({ value: 0, calculatedAt: null });
    expect(parsed.primitives[1].calculatedAt).toEqual(new Date(1_793_491_200_000));
  });
});
