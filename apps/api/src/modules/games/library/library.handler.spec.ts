import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetLibraryHandler } from "./library.handler";
import type { IGameLogsRepository } from "../game-logs.repository.interface";

const log = (over: Record<string, unknown>) => ({
  id: "l", userId: "u-1", gameId: "g-1", status: "playing", platformId: null, platformName: null,
  rating: null, startedAt: null, completedAt: null, playtimeHours: null, notes: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  game: { slug: "doom", title: "Doom", coverImageUrl: null },
  ...over,
});

describe("GetLibraryHandler", () => {
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: GetLibraryHandler;

  beforeEach(() => {
    logsRepo = { listForUser: vi.fn().mockResolvedValue([]) } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new GetLibraryHandler(logsRepo);
  });

  it("returns empty stats for a user with no logs", async () => {
    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(logsRepo.listForUser).toHaveBeenCalledWith("u-1");
    expect(result).toEqual({
      summary: { gameCount: 0, logCount: 0, completedCount: 0, playtimeHours: 0, averageRating: null },
      games: [],
    });
  });

  it("groups logs per game: latest status, latest rating, summed hours", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l3", gameId: "g-1", status: "playing", playtimeHours: "5.5", createdAt: new Date("2026-03-01T00:00:00.000Z") }),
      log({ id: "l2", gameId: "g-1", status: "completed", rating: "9.0", playtimeHours: "20" }),
      log({ id: "l1", gameId: "g-2", status: "abandoned", rating: "4.0", game: { slug: "quake", title: "Quake", coverImageUrl: null } }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games[0]).toEqual({
      slug: "doom", title: "Doom", coverImageUrl: null, status: "playing", rating: 9,
      playtimeHours: 25.5, logCount: 2, lastLoggedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(result.games[1]).toMatchObject({ slug: "quake", rating: 4, playtimeHours: null, logCount: 1 });
    expect(result.summary).toEqual({ gameCount: 2, logCount: 3, completedCount: 1, playtimeHours: 25.5, averageRating: 6.5 });
  });
});
