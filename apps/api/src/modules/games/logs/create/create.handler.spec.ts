import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CreateGameLogHandler } from "./create.handler";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-08T09:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

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
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue({ id: "g-1", platforms: [{ id: "p-1" }] }),
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
    logsRepo = { listForUserGame: vi.fn(), listForUser: vi.fn(), listPlaytimeActivityForUser: vi.fn(), findById: vi.fn(), create: vi.fn().mockResolvedValue(createdRow), update: vi.fn(), delete: vi.fn() };
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
    }, { deltaHours: "12.0", previousHours: null, newHours: "12.0" }, false);
  });

  it("records no playtime entry when the log has no playtime", async () => {
    await handler.handle(request({ status: "playing" }));
    expect(logsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ playtimeHours: null }), null, false);

    await handler.handle(request({ status: "playing", playtimeHours: 0 }));
    expect(logsRepo.create).toHaveBeenLastCalledWith(expect.objectContaining({ playtimeHours: "0" }), null, false);
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
  it.each(["startedAt", "completedAt"])("uses Istanbul today and rejects future %s", async (field) => {
    vi.setSystemTime(new Date("2026-11-07T21:00:00Z"));
    await handler.handle(request({ status: "completed", [field]: "2026-11-08" }));
    expect(logsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ [field]: "2026-11-08" }), null, false);
    logsRepo.create.mockClear();
    await expect(handler.handle(request({ status: "completed", [field]: "2026-11-09" }))).rejects.toThrow("err_log_future_date");
    expect(logsRepo.create).not.toHaveBeenCalled();
  });
  it.each(["startedAt", "completedAt"])("does not accept tomorrow just before Istanbul midnight for %s", async (field) => {
    vi.setSystemTime(new Date("2026-11-07T20:59:59Z"));
    await expect(handler.handle(request({ status: "completed", [field]: "2026-11-08" }))).rejects.toThrow("err_log_future_date");
    expect(logsRepo.create).not.toHaveBeenCalled();
  });
  it.each(["startedAt", "completedAt"])("rejects an invalid nonempty %s", async (field) => {
    await expect(handler.handle(request({ status: "completed", [field]: "2026-02-30" }))).rejects.toThrow("err_log_date");
    expect(logsRepo.create).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown game", async () => {
    gamesRepo.findBySlug.mockResolvedValue(null);
    await expect(handler.handle(request({ status: "playing" }))).rejects.toThrow("Game not found.");
  });
  it("keeps quick logs private and reviews separate from private notes", async () => {
    await handler.handle(request({ status: "completed", notes: "Private", reviewText: "  Public review draft  ", isPublic: true }));
    expect(logsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ notes: "Private", reviewText: "Public review draft" }), null, true);
  });
  it("rejects oversized reviews before persistence", async () => {
    await expect(handler.handle(request({ status: "completed", reviewText: "x".repeat(2001) }))).rejects.toThrow("err_game_review_length");
    expect(logsRepo.create).not.toHaveBeenCalled();
  });

});
