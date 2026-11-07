import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateGameLogHandler } from "./update.handler";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";

const row = {
  id: "l-1", userId: "u-1", gameId: "g-1", status: "playing", platformId: null, platformName: null,
  rating: null, startedAt: null, completedAt: null, playtimeHours: null, notes: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("UpdateGameLogHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: UpdateGameLogHandler;

  beforeEach(() => {
    gamesRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue({ id: "g-1", platforms: [] }),
      findBySlug: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findGameIdsByRelation: vi.fn(),
      findPublicCardsByIds: vi.fn(),
      listPublic: vi.fn(),
      findPublicCompanyPage: vi.fn(),
      loadCatalogIndex: vi.fn(),
      findByIds: vi.fn(),
      findLookupsByIds: vi.fn(),
      listPopularitySources: vi.fn(),
      findOwnerRankingSource: vi.fn(),
      listGameModeCandidates: vi.fn(),
      writeGameModes: vi.fn(),
      writePopularity: vi.fn(),
      writeImportPage: vi.fn(),
      linkDeveloper: vi.fn(),
      unlinkDeveloper: vi.fn(),
      linkPublisher: vi.fn(),
      unlinkPublisher: vi.fn(),
      linkGenre: vi.fn(),
      unlinkGenre: vi.fn(),
      linkPlatform: vi.fn(),
      unlinkPlatform: vi.fn(),
      linkTheme: vi.fn(),
      unlinkTheme: vi.fn(),
    };
    logsRepo = { listForUserGame: vi.fn(), listForUser: vi.fn(), listPlaytimeActivityForUser: vi.fn(), findById: vi.fn().mockResolvedValue(row), create: vi.fn(), update: vi.fn().mockResolvedValue({ ...row, status: "completed" }), delete: vi.fn() };
    handler = new UpdateGameLogHandler(gamesRepo, logsRepo);
  });

  const request = (userId: string, body: Record<string, unknown> = {}) =>
    ({ params: { id: "l-1" }, user: { id: userId }, body: { status: "completed", ...body } }) as any;

  it("updates the owner's log", async () => {
    const result = await handler.handle(request("u-1"));

    expect(logsRepo.update).toHaveBeenCalledWith(
      "l-1",
      expect.objectContaining({ status: "completed", updatedAt: expect.any(Date) }),
      null,
      undefined
    );
    expect(result.status).toBe("completed");
  });

  it("records only the added hours when playtime increases", async () => {
    logsRepo.findById.mockResolvedValue({ ...row, playtimeHours: "5.0" });

    await handler.handle(request("u-1", { playtimeHours: 8 }));

    expect(logsRepo.update).toHaveBeenCalledWith(
      "l-1",
      expect.objectContaining({ playtimeHours: "8" }),
      { deltaHours: "3.0", previousHours: "5.0", newHours: "8.0" },
      undefined
    );
  });

  it("treats a log without playtime as zero hours", async () => {
    await handler.handle(request("u-1", { playtimeHours: 4.5 }));

    expect(logsRepo.update).toHaveBeenCalledWith(
      "l-1",
      expect.anything(),
      { deltaHours: "4.5", previousHours: null, newHours: "4.5" },
      undefined
    );
  });

  it.each([
    ["decreased", 3],
    ["unchanged", 5],
    ["cleared", null],
  ])("records no playtime entry when playtime is %s", async (_label, playtimeHours) => {
    logsRepo.findById.mockResolvedValue({ ...row, playtimeHours: "5.0" });

    await handler.handle(request("u-1", { playtimeHours }));

    expect(logsRepo.update).toHaveBeenCalledWith("l-1", expect.anything(), null, undefined);
  });

  it("hides another user's log as not found", async () => {
    await expect(handler.handle(request("u-2"))).rejects.toThrow("Log not found.");
    expect(logsRepo.update).not.toHaveBeenCalled();
  });
  it("preserves omitted review and sharing fields for older clients", async () => {
    await handler.handle(request("u-1"));
    const [, patch, , sharing] = logsRepo.update.mock.calls[0];
    expect(patch).not.toHaveProperty("reviewText");
    expect(patch).not.toHaveProperty("sharedAt");
    expect(sharing).toBeUndefined();
  });
  it("normalizes a review independently from notes and explicitly unshares", async () => {
    await handler.handle(request("u-1", { reviewText: "  A review  ", notes: "Private note", isPublic: false }));
    expect(logsRepo.update).toHaveBeenCalledWith("l-1", expect.objectContaining({ reviewText: "A review", notes: "Private note" }), null, false);
    await handler.handle(request("u-1", { reviewText: "  ", isPublic: true }));
    expect(logsRepo.update).toHaveBeenLastCalledWith("l-1", expect.objectContaining({ reviewText: null }), null, true);
  });

});
