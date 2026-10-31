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

  const request = (userId: string) =>
    ({ params: { id: "l-1" }, user: { id: userId }, body: { status: "completed" } }) as any;

  it("updates the owner's log", async () => {
    const result = await handler.handle(request("u-1"));

    expect(logsRepo.update).toHaveBeenCalledWith("l-1", expect.objectContaining({ status: "completed", updatedAt: expect.any(Date) }));
    expect(result.status).toBe("completed");
  });

  it("hides another user's log as not found", async () => {
    await expect(handler.handle(request("u-2"))).rejects.toThrow("Log not found.");
    expect(logsRepo.update).not.toHaveBeenCalled();
  });
});
