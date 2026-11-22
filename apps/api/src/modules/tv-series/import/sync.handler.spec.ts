import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { SyncTvSeriesHandler } from "./sync.handler";
import { TvmazeClient, TvmazeError } from "./tvmaze.client";
import type { ITvSourceRepository } from "./tvmaze.types";
function setup() {
  const repository: Record<keyof ITvSourceRepository, any> = {
    state: vi.fn().mockResolvedValue({ nextPage: 0, indexComplete: false, updatesCheckedAt: new Date(), cooldownUntil: null }),
    indexPage: vi.fn(), completeIndex: vi.fn(), updates: vi.fn(), candidates: vi.fn().mockResolvedValue([]), hierarchy: vi.fn(), missing: vi.fn(), failure: vi.fn(), cooldown: vi.fn(), hasMore: vi.fn().mockResolvedValue(false),
  };
  const client = { page: vi.fn().mockResolvedValue(null), hierarchy: vi.fn(), updates: vi.fn().mockResolvedValue([]) };
  return { repository, client, handler: new SyncTvSeriesHandler(client as unknown as TvmazeClient, repository) };
}
describe("SyncTvSeriesHandler", () => {
  it("rejects an empty first catalog without advancing durable progress", async () => {
    const { handler, repository } = setup();
    await expect(handler.handle()).rejects.toThrow("tvmaze_empty_catalog");
    expect(repository.completeIndex).not.toHaveBeenCalled();
  });
  it("advances short and empty raw pages and ends only on 404", async () => {
    const { handler, repository, client } = setup();
    client.page.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([]).mockResolvedValue(null);
    const result = await handler.handle();
    expect(repository.indexPage).toHaveBeenNthCalledWith(1, 0, [{ id: 1 }], expect.any(Date));
    expect(repository.indexPage).toHaveBeenNthCalledWith(2, 1, [], expect.any(Date));
    expect(repository.completeIndex).toHaveBeenCalledOnce();
    expect(result.pages).toBe(2);
  });
  it("retains failed hierarchy, delays it, and continues other titles", async () => {
    const { handler, repository, client } = setup();
    repository.state.mockResolvedValue({ indexComplete: true, updatesCheckedAt: new Date() });
    repository.candidates.mockResolvedValueOnce([{ seriesId: 1, requestedAt: new Date() }, { seriesId: 2, requestedAt: new Date() }]);
    client.hierarchy.mockRejectedValueOnce(new Error("tvmaze_incomplete_episode_snapshot")).mockResolvedValueOnce({ show: { id: 2 } });
    const result = await handler.handle();
    expect(repository.failure).toHaveBeenCalledOnce();
    expect(repository.hierarchy).toHaveBeenCalledOnce();
    expect(result.failed).toBe(1);
    expect(result.hydrated).toBe(1);
  });
  it("persists catalog-page provider backoff before retrying", async () => {
    const { handler, repository, client } = setup();
    client.page.mockRejectedValueOnce(new TvmazeError("tvmaze_http_429", 429));
    await expect(handler.handle()).rejects.toThrow("tvmaze_http_429");
    expect(repository.cooldown).toHaveBeenCalledOnce();
    expect(repository.indexPage).not.toHaveBeenCalled();
  });
  it("leaves the current title queued when the bounded request budget ends", async () => {
    const { handler, repository, client } = setup();
    repository.state.mockResolvedValue({ indexComplete: true, updatesCheckedAt: new Date() });
    repository.candidates.mockResolvedValueOnce([{ seriesId: 1, requestedAt: new Date() }]);
    client.hierarchy.mockRejectedValueOnce(new TvmazeError("tvmaze_budget_exhausted"));
    await handler.handle();
    expect(repository.failure).not.toHaveBeenCalled();
    expect(repository.missing).not.toHaveBeenCalled();
  });
  it("backs off the provider and never deletes snapshots after rate limiting", async () => {
    const { handler, repository, client } = setup();
    repository.candidates.mockResolvedValueOnce([{ seriesId: 1, requestedAt: new Date() }]);
    client.hierarchy.mockRejectedValueOnce(new TvmazeError("tvmaze_http_429", 429));
    await expect(handler.handle()).rejects.toThrow("tvmaze_http_429");
    expect(repository.cooldown).toHaveBeenCalledOnce();
    expect(repository.missing).not.toHaveBeenCalled();
    expect(repository.hierarchy).not.toHaveBeenCalled();
  });
});
