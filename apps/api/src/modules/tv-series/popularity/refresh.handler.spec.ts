import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { RefreshTvPopularityHandler } from "./refresh.handler";
import type { ITvPopularityRepository } from "./tv-popularity.types";
import { TvPopularityClient } from "./tv-popularity.client";
const identities = Array.from({ length: 1002 }, (_, i) => ({ seriesId: i + 1, tmdbId: i + 1, article: `Show_${i}` }));
const source = { provider: "tmdb", sourceDate: "2026-11-21", windowStart: "2026-11-21", expiresAt: "2026-11-24T00:00:00Z", sourceUrl: "https://files.tmdb.org" };
function setup() {
  const repository: Record<keyof ITvPopularityRepository, any> = { state: vi.fn().mockResolvedValue({ identityMap: identities, identitiesCheckedAt: new Date() }), identities: vi.fn(), publish: vi.fn().mockResolvedValue({ generation: 1, matched: 1, queued: 0 }), cooldown: vi.fn() };
  const client = { identities: vi.fn(), tmdb: vi.fn().mockResolvedValue({ values: new Map([[1, 10]]), source }), wikipedia: vi.fn().mockRejectedValue(new Error("offline")) };
  return { repository, client, handler: new RefreshTvPopularityHandler(client as unknown as TvPopularityClient, repository) };
}
describe("RefreshTvPopularityHandler", () => {
  it("publishes an explicitly single-source complete daily snapshot when recent top-pages are unavailable", async () => {
    const { handler, repository } = setup(); const result = await handler.handle();
    expect(result.sources).toBe("tmdb"); expect(result.wikiMatches).toBe(0);
    expect(repository.publish.mock.calls[0][0].sources).toEqual([source]);
  });
  it("keeps the last publication when the primary export fails", async () => {
    const { handler, client, repository } = setup(); client.tmdb.mockRejectedValueOnce(new Error("tv_tmdb_incomplete_export"));
    await expect(handler.handle()).rejects.toThrow("tv_tmdb_incomplete_export");
    expect(repository.publish).not.toHaveBeenCalled(); expect(repository.cooldown).toHaveBeenCalledOnce();
  });
  it("omits colliding exact IDs and adds only positive sparse recent interest", async () => {
    const { handler, client, repository } = setup();
    repository.state.mockResolvedValue({ identityMap: [...identities, { seriesId: 1, tmdbId: 9999, article: "Ambiguous" }], identitiesCheckedAt: new Date() });
    client.tmdb.mockResolvedValue({ values: new Map([[1, 10], [2, 10], [3, 10]]), source });
    client.wikipedia.mockResolvedValue({ values: new Map([["Show_1", 20000]]), source: { ...source, provider: "wikipedia_top" } });
    await handler.handle();
    const scores = repository.publish.mock.calls[0][0].scores;
    expect(scores.find((row: any) => row.seriesId === 1)).toBeUndefined();
    expect(scores.find((row: any) => row.seriesId === 2).score).toBeGreaterThan(scores.find((row: any) => row.seriesId === 3).score);
    expect(scores.find((row: any) => row.seriesId === 3).score).toBe(Math.log1p(10));
  });
});
