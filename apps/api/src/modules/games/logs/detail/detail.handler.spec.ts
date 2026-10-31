import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetGameLogHandler } from "./detail.handler";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";

const row = {
  id: "l-1", userId: "u-1", gameId: "g-1", status: "playing", platformId: null, platformName: null,
  rating: null, startedAt: null, completedAt: null, playtimeHours: null, notes: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("GetGameLogHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: GetGameLogHandler;

  beforeEach(() => {
    gamesRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "g-1", slug: "doom", title: "Doom", coverImageUrl: null,
        platforms: [{ id: "p-1", name: "PC", slug: "win" }],
      }),
    } as unknown as Record<keyof IGamesRepository, any>;
    logsRepo = { findById: vi.fn().mockResolvedValue(row) } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new GetGameLogHandler(gamesRepo, logsRepo);
  });

  it("returns the owner's log with its game", async () => {
    const result = await handler.handle({ params: { id: "l-1" }, user: { id: "u-1" } } as any);

    expect(result.log).toMatchObject({ id: "l-1", status: "playing" });
    expect(result.game).toEqual({ slug: "doom", title: "Doom", coverImageUrl: null, platforms: [{ id: "p-1", name: "PC" }] });
  });

  it("hides another user's log as not found", async () => {
    await expect(handler.handle({ params: { id: "l-1" }, user: { id: "u-2" } } as any)).rejects.toThrow("Log not found.");
  });
});
