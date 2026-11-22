import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { SyncTvIndexHandler } from "./sync.handler";
import { TvIndexClient } from "./tv-index.client";
import type { ITvIndexRepository } from "./tv-index.repository";
function setup(phase = "swap") {
  const state: any = { phase, buildIndex: "tv_series_en__1234567890123_abcdef123456", buildToken: "abcdef123456", scanCursor: null };
  const repository: Record<keyof ITvIndexRepository, any> = {
    state: vi.fn().mockImplementation(async () => state), start: vi.fn().mockResolvedValue(state), page: vi.fn(), advance: vi.fn(), dirty: vi.fn().mockResolvedValue([]), documents: vi.fn(), acknowledge: vi.fn(), prepareSwap: vi.fn().mockResolvedValue(null), finishSwap: vi.fn().mockImplementation(async () => { state.phase = "ready"; }), needed: vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
  };
  const client = { configure: vi.fn(), documents: vi.fn(), remove: vi.fn(), marker: vi.fn().mockResolvedValue(state.buildToken), swap: vi.fn(), settleSwap: vi.fn(), discard: vi.fn().mockResolvedValue(undefined) };
  return { repository, client, state, handler: new SyncTvIndexHandler(client as unknown as TvIndexClient, repository) };
}
describe("SyncTvIndexHandler", () => {
  it("recovers a completed swap after a crash without swapping the old index back", async () => {
    const { handler, repository, client } = setup();
    const result = await handler.handle();
    expect(client.settleSwap).toHaveBeenCalledOnce();
    expect(client.swap).not.toHaveBeenCalled();
    expect(repository.finishSwap).toHaveBeenCalledOnce();
    expect(result.hasMore).toBe(false);
  });
  it("leaves publication pending when a swap fails and never marks an incomplete index ready", async () => {
    const { handler, repository, client } = setup(); client.marker.mockResolvedValue(null); client.swap.mockRejectedValueOnce(new Error("timeout"));
    await expect(handler.handle()).rejects.toThrow("timeout");
    expect(repository.finishSwap).not.toHaveBeenCalled();
  });
  it("retains the durable cursor and dirty revision after a rejected document import", async () => {
    const { handler, repository, client } = setup("scan");
    repository.page.mockResolvedValue({ ids: [7], documents: [{ id: 7 }] });
    client.documents.mockRejectedValueOnce(new Error("failed"));
    await expect(handler.handle()).rejects.toThrow("failed");
    expect(repository.advance).not.toHaveBeenCalled(); expect(repository.acknowledge).not.toHaveBeenCalled();
  });
});
