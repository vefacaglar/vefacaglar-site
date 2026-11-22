import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { collectCompletionTimes } from "./igdb-completion-times";

const row = (id: number, patch = {}) => ({ id, game_id: id, hastily: 3600, normally: 7200, completely: 10800, count: 1, updated_at: 1793491200, ...patch });

describe("complete IGDB time snapshot", () => {
  it("advances the raw source cursor even across unusable duration categories", async () => {
    const first = Array.from({ length: 500 }, (_, i) => row(i + 1, { hastily: 0, normally: 0, completely: 0 }));
    const query = vi.fn().mockResolvedValueOnce({ count: 501 }).mockResolvedValueOnce(first)
      .mockResolvedValueOnce([row(600)]).mockResolvedValueOnce({ count: 501 });
    const result = await collectCompletionTimes(query);
    expect(query.mock.calls[2][1]).toContain("id>500");
    expect(result).toHaveLength(501);
    expect(result[0].hastilySeconds).toBeNull();
  });
  it("retries a complete pass once when the count changes", async () => {
    const query = vi.fn().mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce([row(1)])
      .mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce([row(1)]).mockResolvedValueOnce({ count: 1 });
    expect(await collectCompletionTimes(query)).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(6);
  });
  it("rejects partial, nonadvancing, and duplicate game data", async () => {
    const query = vi.fn().mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce([row(1), row(2, { game_id: 1 })]);
    await expect(collectCompletionTimes(query)).rejects.toThrow("duplicate");
    const nonadvancing = vi.fn().mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce([row(2), row(1)]);
    await expect(collectCompletionTimes(nonadvancing)).rejects.toThrow("Malformed");
  });
  it("cannot publish an empty feed even when the endpoint claims zero", async () => {
    await expect(collectCompletionTimes(vi.fn().mockResolvedValue({ count: 0 }))).rejects.toThrow("empty");
  });
});
