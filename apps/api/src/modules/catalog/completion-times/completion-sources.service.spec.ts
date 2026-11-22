import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { CompletionSourcesService } from "./completion-sources.service";
import { CompletionSourceError } from "./completion-sources.client";

const identity = { igdbId: 1, slug: "test-game", wikidataId: "Q1", ifdbId: "abcdefghijklmnop", vndbId: "v1" };
const report = { provider: "backloggd", sourceUrl: "https://backloggd.com/games/test-game/", finishSeconds: 108000, masterSeconds: null,
  playtimeSeconds: null, sampleCount: null, sourceUpdatedAt: null, fetchedAt: "2026-11-22T00:00:00Z", scope: "All editions", statistic: "reported" };

function setup() {
  const client = { canonical: vi.fn().mockResolvedValue([{ igdbId: 1, slug: "test-game" }]), robots: vi.fn().mockResolvedValue("User-agent: *"),
    backloggd: vi.fn().mockResolvedValue(report), identities: vi.fn(), vndb: vi.fn().mockResolvedValue(new Map()), ifdb: vi.fn().mockResolvedValue(null) };
  const repository = { state: vi.fn().mockImplementation(async (provider: string) => provider === "identity-map"
    ? { identityMap: [identity], mapCheckedAt: new Date(), cooldownUntil: null } : null), failure: vi.fn(), saveMap: vi.fn(), catalogSlugs: vi.fn(),
    backloggdCandidates: vi.fn().mockResolvedValue([identity]), due: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation(async (rows: any[]) => ({ accepted: rows.filter((row) => row.report).length, added: rows.filter((row) => row.report).length })) };
  return { client, repository, service: new CompletionSourcesService(client as any, repository as any) };
}

describe("bounded independent completion refresh", () => {
  it("persists a negative check so the first missing cohort is not selected forever", async () => {
    const { service, client, repository } = setup();
    client.backloggd.mockResolvedValue(null as any);
    await service.refresh();
    expect(repository.save).toHaveBeenCalledWith([expect.objectContaining({ provider: "backloggd", report: null, nextCheckAt: expect.any(Date) })], expect.any(Date));
    const next = repository.save.mock.calls[0][0][0].nextCheckAt;
    expect(next.getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000);
  });
  it("stops a blocked provider while allowing other official APIs to refresh", async () => {
    const { service, client, repository } = setup();
    client.backloggd.mockRejectedValue(new CompletionSourceError("completion_source_http_403"));
    repository.due.mockImplementation(async (provider: string) => provider === "vndb" ? [identity] : []);
    client.vndb.mockResolvedValue(new Map([[1, { ...report, provider: "vndb", finishSeconds: null, playtimeSeconds: 7200 }]]));
    const result = await service.refresh();
    expect(result.sources.find((source) => source.provider === "backloggd")?.status).toContain("403");
    expect(result.sources.find((source) => source.provider === "vndb")?.accepted).toBe(1);
    expect(client.backloggd).toHaveBeenCalledTimes(1);
  });
  it("retains previously verified mappings when identity discovery fails", async () => {
    const { service, client, repository } = setup();
    repository.state.mockImplementation(async (provider: string) => provider === "identity-map"
      ? { identityMap: [identity], mapCheckedAt: new Date(0), cooldownUntil: null } : null);
    client.identities.mockRejectedValue(new Error("unavailable"));
    expect((await service.refresh()).identityCount).toBe(1);
    expect(repository.saveMap).not.toHaveBeenCalled();
    expect(repository.failure).toHaveBeenCalledWith("identity-map", expect.any(String), expect.any(Date));
  });
  it("uses cached cooldowns without making forbidden retries", async () => {
    const { service, client, repository } = setup();
    repository.state.mockImplementation(async () => ({ cooldownUntil: new Date(Date.now() + 3600000), identityMap: [], mapCheckedAt: null }));
    const result = await service.refresh();
    expect(result.sources.every((source) => source.status === "cooldown")).toBe(true);
    expect(client.backloggd).not.toHaveBeenCalled();
    expect(client.vndb).not.toHaveBeenCalled();
    expect(client.ifdb).not.toHaveBeenCalled();
  });
});
