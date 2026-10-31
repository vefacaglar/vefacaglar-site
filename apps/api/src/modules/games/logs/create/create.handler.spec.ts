import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateGameLogHandler } from "./create.handler";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";

const createdRow = {
  id: "l-1", status: "playing", platformId: null, platformName: null, rating: null,
  startedAt: null, completedAt: null, playtimeHours: null, notes: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("CreateGameLogHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: CreateGameLogHandler;

  beforeEach(() => {
    gamesRepo = {
      findBySlug: vi.fn().mockResolvedValue({ id: "g-1", platforms: [{ id: "p-1" }] }),
    } as unknown as Record<keyof IGamesRepository, any>;
    logsRepo = { create: vi.fn().mockResolvedValue(createdRow) } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new CreateGameLogHandler(gamesRepo, logsRepo);
  });

  const request = (body: any) => ({ params: { slug: "doom" }, user: { id: "u-1" }, body }) as any;

  it("creates a log for the user, storing playtime as a decimal string", async () => {
    await handler.handle(request({ status: "completed", platformId: "p-1", rating: 85, playtimeHours: 12, notes: "  great  " }));

    expect(logsRepo.create).toHaveBeenCalledWith({
      status: "completed",
      platformId: "p-1",
      rating: 85,
      startedAt: null,
      completedAt: null,
      playtimeHours: "12",
      notes: "great",
      userId: "u-1",
      gameId: "g-1",
    });
  });

  it("rejects a platform the game is not on", async () => {
    await expect(handler.handle(request({ status: "playing", platformId: "p-9" }))).rejects.toThrow("selected platform");
    expect(logsRepo.create).not.toHaveBeenCalled();
  });

  it("rejects a completion date before the start date", async () => {
    await expect(
      handler.handle(request({ status: "completed", startedAt: "2026-02-01", completedAt: "2026-01-01" }))
    ).rejects.toThrow("Completion date");
  });

  it("throws NotFound for an unknown game", async () => {
    gamesRepo.findBySlug.mockResolvedValue(null);
    await expect(handler.handle(request({ status: "playing" }))).rejects.toThrow("Game not found.");
  });
});
