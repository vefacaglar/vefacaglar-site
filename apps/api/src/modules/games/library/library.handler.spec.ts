import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetLibraryHandler } from "./library.handler";
import type { IGameLogsRepository } from "../game-logs.repository.interface";

const log = (over: Record<string, unknown>) => ({
  id: "l", userId: "u-1", gameId: "g-1", status: "playing", platformId: null, platformName: null,
  rating: null, startedAt: null, completedAt: null, playtimeHours: null, notes: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: null,
  game: { slug: "doom", title: "Doom", coverImageUrl: null, criticScore: null, criticScoreCount: null },
  ...over,
});
const quake = { slug: "quake", title: "Quake", coverImageUrl: null, criticScore: null, criticScoreCount: null };

describe("GetLibraryHandler", () => {
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: GetLibraryHandler;

  beforeEach(() => {
    logsRepo = {
      listForUser: vi.fn().mockResolvedValue([]),
      listPlaytimeActivityForUser: vi.fn().mockResolvedValue([]),
    } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new GetLibraryHandler(logsRepo);
  });

  it("returns empty stats for a user with no logs", async () => {
    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(logsRepo.listForUser).toHaveBeenCalledWith("u-1");
    expect(logsRepo.listPlaytimeActivityForUser).toHaveBeenCalledWith("u-1");
    expect(result).toEqual({
      summary: { gameCount: 0, logCount: 0, completedCount: 0, playtimeHours: 0, averageRating: null, platforms: [] },
      games: [],
    });
  });

  it("groups logs per game: latest status, latest rating, summed hours", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l3", gameId: "g-1", status: "playing", playtimeHours: "5.5", createdAt: new Date("2026-03-01T00:00:00.000Z") }),
      log({ id: "l2", gameId: "g-1", status: "completed", rating: 90, playtimeHours: "20", completedAt: "2026-02-01" }),
      log({ id: "l1", gameId: "g-2", status: "abandoned", rating: 40, game: quake }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games[0]).toEqual({
      slug: "doom", title: "Doom", coverImageUrl: null, status: "playing", rating: 90,
      playtimeHours: 25.5, logCount: 2, lastLoggedAt: "2026-03-01T00:00:00.000Z",
      completedAt: "2026-02-01", lastActivityAt: "2026-03-01T00:00:00.000Z",
      platformName: null, criticScore: null, addedAt: "2026-01-01T00:00:00.000Z", latestLogId: "l3",
    });
    expect(result.games[1]).toMatchObject({
      slug: "quake", rating: 40, playtimeHours: null, logCount: 1,
      completedAt: null, lastActivityAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.summary).toEqual({
      gameCount: 2, logCount: 3, completedCount: 1, playtimeHours: 25.5, averageRating: 65, platforms: [],
    });
  });

  it("picks the latest completion date across a game's logs", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l3", completedAt: null }),
      log({ id: "l2", completedAt: "2025-06-10" }),
      log({ id: "l1", completedAt: "2025-12-24" }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games[0].completedAt).toBe("2025-12-24");
  });

  it("uses the latest of log creation, log updates and playtime entries as last activity", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l2", createdAt: new Date("2026-03-01T00:00:00.000Z"), updatedAt: null }),
      log({ id: "l1", createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-04-01T00:00:00.000Z") }),
      log({ id: "l9", gameId: "g-2", createdAt: new Date("2026-01-01T00:00:00.000Z"), game: quake }),
    ]);
    logsRepo.listPlaytimeActivityForUser.mockResolvedValue([
      { userGameId: "l2", lastRecordedAt: new Date("2026-03-15T00:00:00.000Z") },
      { userGameId: "l9", lastRecordedAt: new Date("2026-05-05T10:00:00.000Z") },
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games[0]).toMatchObject({ slug: "doom", lastActivityAt: "2026-04-01T00:00:00.000Z" });
    expect(result.games[1]).toMatchObject({ slug: "quake", lastActivityAt: "2026-05-05T10:00:00.000Z" });
  });

  it("uses the platform of the most recent log that has one", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l3", platformId: null, platformName: null, createdAt: new Date("2026-03-01T00:00:00.000Z") }),
      log({ id: "l2", platformId: "p-ps5", platformName: "PlayStation 5", createdAt: new Date("2026-02-01T00:00:00.000Z") }),
      log({ id: "l1", platformId: "p-pc", platformName: "PC", createdAt: new Date("2026-01-01T00:00:00.000Z") }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games[0]).toMatchObject({ platformName: "PlayStation 5", latestLogId: "l3" });
  });

  it("sets addedAt to the earliest log and latestLogId to the most recent one", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l3", createdAt: new Date("2026-03-01T00:00:00.000Z") }),
      log({ id: "l2", createdAt: new Date("2026-02-01T00:00:00.000Z") }),
      log({ id: "l1", createdAt: new Date("2025-11-15T08:00:00.000Z") }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games[0]).toMatchObject({
      addedAt: "2025-11-15T08:00:00.000Z", lastLoggedAt: "2026-03-01T00:00:00.000Z", latestLogId: "l3",
    });
  });

  it("exposes the catalog critic score only when it rests on enough reviews", async () => {
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l2", gameId: "g-1", game: { slug: "doom", title: "Doom", coverImageUrl: null, criticScore: 88, criticScoreCount: 12 } }),
      log({ id: "l1", gameId: "g-2", game: { ...quake, criticScore: 95, criticScoreCount: 1 } }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.games.map((g) => g.criticScore)).toEqual([88, null]);
  });

  it("counts distinct games per platform, excluding games without one, by count desc then name asc", async () => {
    const game = (slug: string) => ({ ...quake, slug, title: slug });
    logsRepo.listForUser.mockResolvedValue([
      // g-1: two logs on PC still count as one game.
      log({ id: "a2", gameId: "g-1", platformName: "PC", game: game("a") }),
      log({ id: "a1", gameId: "g-1", platformName: "PC", game: game("a") }),
      // g-2: latest platformed log is Switch, so the older PC log doesn't count.
      log({ id: "b2", gameId: "g-2", platformName: "Switch", game: game("b") }),
      log({ id: "b1", gameId: "g-2", platformName: "PC", game: game("b") }),
      log({ id: "c1", gameId: "g-3", platformName: "Switch", game: game("c") }),
      log({ id: "d1", gameId: "g-4", platformName: "PlayStation 5", game: game("d") }),
      log({ id: "e1", gameId: "g-5", platformName: "Xbox", game: game("e") }),
      log({ id: "f1", gameId: "g-6", platformName: null, game: game("f") }),
      log({ id: "g1", gameId: "g-7", platformName: "PC", game: game("g") }),
    ]);

    const result = await handler.handle({ user: { id: "u-1" } } as any);

    expect(result.summary.platforms).toEqual([
      { name: "PC", count: 2 },
      { name: "Switch", count: 2 },
      { name: "PlayStation 5", count: 1 },
      { name: "Xbox", count: 1 },
    ]);
  });
});
