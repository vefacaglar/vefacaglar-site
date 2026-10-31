import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListGameLogsHandler } from "./list.handler";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";

describe("ListGameLogsHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: ListGameLogsHandler;

  beforeEach(() => {
    gamesRepo = { findBySlug: vi.fn().mockResolvedValue({ id: "g-1" }) } as unknown as Record<keyof IGamesRepository, any>;
    logsRepo = { listForUserGame: vi.fn().mockResolvedValue([]) } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new ListGameLogsHandler(gamesRepo, logsRepo);
  });

  it("lists only the requesting user's logs", async () => {
    logsRepo.listForUserGame.mockResolvedValue([
      {
        id: "l-1", status: "completed", platformId: "p-1", platformName: "PC", rating: "8.5",
        startedAt: null, completedAt: "2026-01-02", playtimeHours: null, notes: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const result = await handler.handle({ params: { slug: "doom" }, user: { id: "u-1" } } as any);

    expect(logsRepo.listForUserGame).toHaveBeenCalledWith("u-1", "g-1");
    expect(result.items[0]).toMatchObject({ id: "l-1", rating: 8.5, platform: { id: "p-1", name: "PC" } });
  });

  it("throws NotFound for an unknown game", async () => {
    gamesRepo.findBySlug.mockResolvedValue(null);
    await expect(handler.handle({ params: { slug: "x" }, user: { id: "u-1" } } as any)).rejects.toThrow("Game not found.");
  });
});
