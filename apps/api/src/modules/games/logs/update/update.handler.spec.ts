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
    gamesRepo = { findById: vi.fn().mockResolvedValue({ id: "g-1", platforms: [] }) } as unknown as Record<keyof IGamesRepository, any>;
    logsRepo = {
      findById: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({ ...row, status: "completed" }),
    } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new UpdateGameLogHandler(gamesRepo, logsRepo);
  });

  const request = (userId: string, body: Record<string, unknown> = {}) =>
    ({ params: { id: "l-1" }, user: { id: userId }, body: { status: "completed", ...body } }) as any;

  it("updates the owner's log", async () => {
    const result = await handler.handle(request("u-1"));

    expect(logsRepo.update).toHaveBeenCalledWith(
      "l-1",
      expect.objectContaining({ status: "completed", updatedAt: expect.any(Date) }),
      null
    );
    expect(result.status).toBe("completed");
  });

  it("records only the added hours when playtime increases", async () => {
    logsRepo.findById.mockResolvedValue({ ...row, playtimeHours: "5.0" });

    await handler.handle(request("u-1", { playtimeHours: 8 }));

    expect(logsRepo.update).toHaveBeenCalledWith(
      "l-1",
      expect.objectContaining({ playtimeHours: "8" }),
      { deltaHours: "3.0", previousHours: "5.0", newHours: "8.0" }
    );
  });

  it("treats a log without playtime as zero hours", async () => {
    await handler.handle(request("u-1", { playtimeHours: 4.5 }));

    expect(logsRepo.update).toHaveBeenCalledWith(
      "l-1",
      expect.anything(),
      { deltaHours: "4.5", previousHours: null, newHours: "4.5" }
    );
  });

  it.each([
    ["decreased", 3],
    ["unchanged", 5],
    ["cleared", null],
  ])("records no playtime entry when playtime is %s", async (_label, playtimeHours) => {
    logsRepo.findById.mockResolvedValue({ ...row, playtimeHours: "5.0" });

    await handler.handle(request("u-1", { playtimeHours }));

    expect(logsRepo.update).toHaveBeenCalledWith("l-1", expect.anything(), null);
  });

  it("hides another user's log as not found", async () => {
    await expect(handler.handle(request("u-2"))).rejects.toThrow("Log not found.");
    expect(logsRepo.update).not.toHaveBeenCalled();
  });
});
