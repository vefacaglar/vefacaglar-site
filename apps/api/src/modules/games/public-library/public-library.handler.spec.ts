import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPublicLibraryHandler } from "./public-library.handler";
import type { IGameLogsRepository } from "../game-logs.repository.interface";
import type { IUsersRepository } from "../../auth/users.repository.interface";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../shared/http-errors";

const user = (over: Record<string, unknown> = {}) => ({
  id: "u-1",
  email: "vefa@example.com",
  username: "vefa",
  displayName: "Vefa Çağlar",
  role: "user",
  isActive: true,
  isProfilePublic: true,
  ...over,
});

const log = (over: Record<string, unknown>) => ({
  id: "l", userId: "u-1", gameId: "g-1", status: "playing", platformId: null, platformName: null,
  rating: null, startedAt: null, completedAt: null, playtimeHours: null,
  notes: "private note", reviewText: "private review", purchasePrice: "59.99",
  createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: null,
  game: { slug: "doom", title: "Doom", coverImageUrl: null },
  ...over,
});

const request = (username = "vefa", viewerId?: string) =>
  ({ params: { username }, user: viewerId ? { id: viewerId } : undefined }) as any;

describe("GetPublicLibraryHandler", () => {
  let usersRepo: Record<keyof IUsersRepository, any>;
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: GetPublicLibraryHandler;

  beforeEach(() => {
    usersRepo = { findByUsername: vi.fn() } as unknown as Record<keyof IUsersRepository, any>;
    logsRepo = {
      listForUser: vi.fn().mockResolvedValue([]),
      listPlaytimeActivityForUser: vi.fn().mockResolvedValue([]),
    } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new GetPublicLibraryHandler(usersRepo, logsRepo);
  });

  it("returns the public user identity and library stats for a public profile", async () => {
    usersRepo.findByUsername.mockResolvedValue(user());
    logsRepo.listForUser.mockResolvedValue([
      log({ id: "l2", gameId: "g-1", status: "completed", rating: 80, playtimeHours: "12", completedAt: "2026-01-20" }),
    ]);
    logsRepo.listPlaytimeActivityForUser.mockResolvedValue([
      { userGameId: "l2", lastRecordedAt: new Date("2026-01-20T18:30:00.000Z") },
    ]);

    const result = await handler.handle(request());

    expect(usersRepo.findByUsername).toHaveBeenCalledWith("vefa");
    expect(logsRepo.listForUser).toHaveBeenCalledWith("u-1");
    expect(logsRepo.listPlaytimeActivityForUser).toHaveBeenCalledWith("u-1");
    expect(result).toEqual({
      user: { username: "vefa", displayName: "Vefa Çağlar", isProfilePublic: true },
      isOwner: false,
      summary: { gameCount: 1, logCount: 1, completedCount: 1, playtimeHours: 12, averageRating: 80 },
      games: [{
        slug: "doom", title: "Doom", coverImageUrl: null, status: "completed", rating: 80,
        playtimeHours: 12, logCount: 1, lastLoggedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-20", lastActivityAt: "2026-01-20T18:30:00.000Z",
      }],
    });
  });

  it("never exposes the user's id, email, or private log fields", async () => {
    usersRepo.findByUsername.mockResolvedValue(user());
    logsRepo.listForUser.mockResolvedValue([log({})]);

    const serialized = JSON.stringify(await handler.handle(request()));

    expect(serialized).not.toContain("u-1");
    expect(serialized).not.toContain("vefa@example.com");
    expect(serialized).not.toContain("private note");
    expect(serialized).not.toContain("private review");
    expect(serialized).not.toContain("59.99");
  });

  it("flags the owner when a signed-in user views their own public library", async () => {
    usersRepo.findByUsername.mockResolvedValue(user());

    const result = await handler.handle(request("vefa", "u-1"));

    expect(result.isOwner).toBe(true);
  });

  it("lets the owner see their own private library", async () => {
    usersRepo.findByUsername.mockResolvedValue(user({ isProfilePublic: false }));
    logsRepo.listForUser.mockResolvedValue([log({})]);

    const result = await handler.handle(request("vefa", "u-1"));

    expect(logsRepo.listForUser).toHaveBeenCalledWith("u-1");
    expect(result.user).toEqual({ username: "vefa", displayName: "Vefa Çağlar", isProfilePublic: false });
    expect(result.isOwner).toBe(true);
    expect(result.summary.logCount).toBe(1);
  });

  it("returns 401 with err_profile_private to an anonymous visitor of a private library", async () => {
    usersRepo.findByUsername.mockResolvedValue(user({ isProfilePublic: false }));

    const error = await handler.handle(request()).catch((e) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("err_profile_private");
    expect(logsRepo.listForUser).not.toHaveBeenCalled();
    expect(logsRepo.listPlaytimeActivityForUser).not.toHaveBeenCalled();
  });

  it("returns 403 with err_profile_private to a signed-in stranger viewing a private library", async () => {
    usersRepo.findByUsername.mockResolvedValue(user({ isProfilePublic: false }));

    const error = await handler.handle(request("vefa", "u-2")).catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("err_profile_private");
    expect(logsRepo.listForUser).not.toHaveBeenCalled();
    expect(logsRepo.listPlaytimeActivityForUser).not.toHaveBeenCalled();
  });

  it("returns 404 to the owner when their account is inactive", async () => {
    usersRepo.findByUsername.mockResolvedValue(user({ isActive: false, isProfilePublic: false }));

    await expect(handler.handle(request("vefa", "u-1"))).rejects.toThrow(NotFoundError);
  });

  it.each([
    ["the user does not exist", null],
    ["the user is inactive", user({ isActive: false })],
  ])("returns 404 with err_profile_not_found when %s, signed in or not", async (_label, found) => {
    usersRepo.findByUsername.mockResolvedValue(found);

    for (const viewer of [undefined, "u-2"]) {
      const error = await handler.handle(request("vefa", viewer)).catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("err_profile_not_found");
    }
    expect(logsRepo.listForUser).not.toHaveBeenCalled();
    expect(logsRepo.listPlaytimeActivityForUser).not.toHaveBeenCalled();
  });
});
