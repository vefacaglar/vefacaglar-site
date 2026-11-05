import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { LookupHltbHandler } from "./lookup.handler";
import { ApplyHltbHandler } from "../apply/apply.handler";
import { RetryHltbSyncHandler } from "../retry-sync/retry-sync.handler";
import type { HltbLookupService } from "../hltb.service";
import { acceptBackgroundMapping, assertReceipt, candidateDto, gameVersion, mergeHours, requiresMismatchAcknowledgement } from "../hltb-policy";
import { retryAt } from "../../import/hltb.client";
import type { HltbGame, LookupReceipt, ApplyInput } from "../hltb.types";
const game: HltbGame = { id: "game", title: "The Witcher 3: Wild Hunt", releaseYear: 2015, hltbId: 100, mappingSource: "imported", times: { mainHours: 50, mainExtraHours: null, completionistHours: 170 } };
const candidate = { hltbId: 100, title: game.title, releaseYear: 2015, times: { mainHours: 55, mainExtraHours: 100, completionistHours: null }, completed: null, backlog: null, playing: null };
const input: ApplyInput = { receiptId: "receipt", hltbId: 100, expectedVersion: gameVersion(game) };
function receipt(): LookupReceipt { return { gameId: game.id, receiptId: "receipt", query: game.title, expectedVersion: gameVersion(game), candidates: [candidate], outcome: "matches", checkedAt: new Date(), expiresAt: new Date(Date.now() + 60000), retryAfter: null, failureCount: 0, pendingSearchSync: false, syncVersion: null }; }

describe("HowLongToBeat handlers", () => {
  it("forwards lookup query and returns unavailable DTO without inventing candidates", async () => {
    const dto = { outcome: "provider_unavailable", candidates: [], retryAfter: "2026-11-06T01:00:00Z" };
    const service = { lookup: vi.fn().mockResolvedValue(dto) };
    const handler = new LookupHltbHandler(service as unknown as HltbLookupService);
    expect(await handler.handle({ params: { id: "game" }, body: { query: "alternate title", refresh: true } } as any)).toEqual(dto);
    expect(service.lookup).toHaveBeenCalledWith("game", { query: "alternate title", refresh: true });
  });
  it("forwards explicit apply flags and returns actual saved hours and pending status", async () => {
    const body = { ...input, overwriteFields: ["mainHours"], replaceMapping: true, acknowledgeMismatch: true };
    const result = { game, searchSync: "pending" };
    const service = { apply: vi.fn().mockResolvedValue(result) };
    const handler = new ApplyHltbHandler(service as unknown as HltbLookupService);
    expect(await handler.handle({ params: { id: "game" }, body } as any)).toEqual(result);
    expect(service.apply).toHaveBeenCalledWith("game", body);
  });
  it("preserves application conflicts from its service", async () => {
    const conflict = new Error("receipt expired");
    const handler = new ApplyHltbHandler({ apply: vi.fn().mockRejectedValue(conflict) } as unknown as HltbLookupService);
    await expect(handler.handle({ params: { id: "game" }, body: input } as any)).rejects.toBe(conflict);
  });
  it("uses the idempotent search-only retry path", async () => {
    const service = { retrySync: vi.fn().mockResolvedValue({ game, searchSync: "synced" }) };
    expect(await new RetryHltbSyncHandler(service as unknown as HltbLookupService).handle({ params: { id: "game" } } as any)).toEqual({ game, searchSync: "synced" });
    expect(service.retrySync).toHaveBeenCalledWith("game");
  });
});
describe("receipt and merge policy", () => {
  it("fills nulls and preserves existing manually curated values by default", () => {
    expect(mergeHours(game.times, candidate.times)).toEqual({ mainHours: 50, mainExtraHours: 100, completionistHours: 170 });
  });
  it("overwrites only selected non-null source fields and never clears a value", () => {
    expect(mergeHours(game.times, candidate.times, ["mainHours", "completionistHours"])).toEqual({ mainHours: 55, mainExtraHours: 100, completionistHours: 170 });
  });
  it.each([null, { ...receipt(), receiptId: "forged" }, { ...receipt(), gameId: "other" }, { ...receipt(), expiresAt: new Date(0) }, { ...receipt(), candidates: [] }, { ...receipt(), outcome: "provider_unavailable" }])("rejects missing, forged, unrelated, expired or unavailable receipts", (value) => {
    expect(() => assertReceipt(game, value as LookupReceipt | null, input)).toThrow();
  });
  it("detects concurrent duration, title, release-year and mapping changes", () => {
    for (const changed of [{ ...game, times: { ...game.times, mainHours: 80 } }, { ...game, title: "Other" }, { ...game, releaseYear: 2016 }, { ...game, hltbId: 200 }]) expect(() => assertReceipt(changed, receipt(), input)).toThrow("err_hltb_game_changed");
  });
  it("requires a separate remap acknowledgement", () => {
    const other = { ...candidate, hltbId: 200 };
    expect(() => assertReceipt(game, { ...receipt(), candidates: [other] }, { ...input, hltbId: 200, overwriteFields: ["mainHours"] })).toThrow("err_hltb_remap_required");
    expect(() => assertReceipt(game, { ...receipt(), candidates: [other] }, { ...input, hltbId: 200, replaceMapping: true })).not.toThrow();
  });
  it("warns on title/year differences without inventing a missing release year", () => {
    expect(requiresMismatchAcknowledgement(game, { ...candidate, releaseYear: 2000 })).toBe(true);
    expect(requiresMismatchAcknowledgement(game, { ...candidate, title: "The Witcher 3 Complete Edition" })).toBe(true);
    expect(requiresMismatchAcknowledgement(game, { ...candidate, releaseYear: null })).toBe(false);
    expect(candidateDto(game, { ...candidate, releaseYear: null })).toMatchObject({ releaseYear: null, sourceUrl: "https://howlongtobeat.com/game/100", warnings: ["HowLongToBeat does not provide a release year."] });
  });
  it("never rebinds an existing mapping or supplements hours for another game's entry", () => {
    expect(acceptBackgroundMapping("game", 200, 100, null)).toBe(false);
    expect(acceptBackgroundMapping("game", 100, 100, "other")).toBe(false);
    expect(acceptBackgroundMapping("game", 100, null, "other")).toBe(false);
    expect(acceptBackgroundMapping("game", 100, 100, "game")).toBe(true);
    expect(acceptBackgroundMapping("game", 100, null, null)).toBe(true);
  });
  it("uses provider cooldowns including long or overflowing Retry-After values", () => {
    const now = Date.parse("2026-11-06T00:00:00Z");
    expect(retryAt("172800", 60000, now).getTime()).toBe(now + 172800000);
    expect(retryAt("invalid", 60000, now).getTime()).toBe(now + 60000);
    expect(retryAt("9".repeat(400), 60000, now).getTime()).toBe(8640000000000000);
    expect(retryAt("Fri, 06 Nov 2026 02:00:00 GMT", 60000, now).getTime()).toBe(now + 7200000);
  });
});
