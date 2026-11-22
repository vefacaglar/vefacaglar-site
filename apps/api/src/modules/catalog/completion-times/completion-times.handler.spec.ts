import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { RefreshGameCompletionTimesHandler } from "./completion-times.handler";
import { usableCompletionTimes } from "./completion-times-quality";

const row = (patch = {}) => ({ igdbId: 1, sourceId: 1, hastilySeconds: 3600, normallySeconds: 7200,
  completelySeconds: 10800, sampleCount: 4, sourceUpdatedAt: new Date("2026-11-01T00:00:00Z"), ...patch });

describe("RefreshGameCompletionTimesHandler", () => {
  it("publishes complete raw provider values and reports usable matched coverage", async () => {
    const source = { collect: vi.fn().mockResolvedValue([row(), row({ igdbId: 2, hastilySeconds: 999999999, normallySeconds: null, completelySeconds: null })]) };
    const repo = { publish: vi.fn().mockResolvedValue({ matchedGames: 2, usableGames: 1 }) };
    const result = await new RefreshGameCompletionTimesHandler(source, repo).handle();
    expect(repo.publish).toHaveBeenCalledWith(await source.collect.mock.results[0].value, expect.any(Date));
    expect(result).toMatchObject({ providerRecords: 2, usableRecords: 1, matchedGames: 2, usableGames: 1 });
  });

  it.each([new Error("incomplete source"), new Error("IGDB blocked")])("preserves prior data when collection fails", async (error) => {
    const repo = { publish: vi.fn() };
    const handler = new RefreshGameCompletionTimesHandler({ collect: vi.fn().mockRejectedValue(error) }, repo);
    await expect(handler.handle()).rejects.toThrow(error.message);
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("rejects empty data before publication", async () => {
    const repo = { publish: vi.fn() };
    await expect(new RefreshGameCompletionTimesHandler({ collect: vi.fn().mockResolvedValue([]) }, repo).handle()).rejects.toThrow("Empty");
    expect(repo.publish).not.toHaveBeenCalled();
  });
});

describe("completion-time display quality", () => {
  it("retains low samples with explicit provenance", () => {
    expect(usableCompletionTimes(row({ sampleCount: 1 }))).toMatchObject({ creditsSeconds: 3600, sampleCount: 1, source: "IGDB" });
  });
  it("drops impossible categories and keeps other usable values", () => {
    expect(usableCompletionTimes(row({ hastilySeconds: 20889 * 3600, normallySeconds: 3600, completelySeconds: null })))
      .toMatchObject({ creditsSeconds: null, extrasSeconds: 3600, completionistSeconds: null });
  });
  it("suppresses contradictory pairs without inventing category corrections", () => {
    expect(usableCompletionTimes(row({ hastilySeconds: 7200, normallySeconds: 3600, completelySeconds: 10800 })))
      .toMatchObject({ creditsSeconds: null, extrasSeconds: null, completionistSeconds: 10800 });
  });
  it.each([0, -1, 1.5])("requires a real submission count %j", (sampleCount) => {
    expect(usableCompletionTimes(row({ sampleCount }))).toBeNull();
  });
  it("never treats missing or zero durations as completion data", () => {
    expect(usableCompletionTimes(row({ hastilySeconds: 0, normallySeconds: null, completelySeconds: -1 }))).toBeNull();
  });
});
