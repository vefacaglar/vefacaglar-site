import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";
import { AuthService, SESSION_ABSOLUTE_LIFETIME_MS, SESSION_IDLE_LIFETIME_MS } from "./auth.service";
import type { IUsersRepository } from "./users.repository.interface";
import type { ISessionsRepository } from "./sessions.repository.interface";
import { hashToken } from "./auth.utils";
import { UnauthorizedError } from "../../shared/http-errors";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-14T12:00:00Z").getTime();

const request = (token = "tok") => ({ headers: { authorization: `Bearer ${token}` } }) as unknown as FastifyRequest;

function session(createdAgo: number, expiresIn: number) {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: hashToken("tok"),
    createdAt: new Date(NOW - createdAgo),
    expiresAt: new Date(NOW + expiresIn),
    revokedAt: null,
  };
}

describe("AuthService.authenticate", () => {
  let usersRepo: Record<keyof IUsersRepository, any>;
  let sessionsRepo: Record<keyof ISessionsRepository, any>;
  let service: AuthService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    usersRepo = {
      findById: vi.fn().mockResolvedValue({ id: "user-1", isActive: true }),
    } as unknown as Record<keyof IUsersRepository, any>;
    sessionsRepo = {
      create: vi.fn(),
      findActiveByTokenHash: vi.fn(),
      revoke: vi.fn(),
      extend: vi.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(usersRepo as unknown as IUsersRepository, sessionsRepo as unknown as ISessionsRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("looks the session up by the token hash", async () => {
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(session(0, SESSION_IDLE_LIFETIME_MS));

    await service.authenticate(request("tok"));

    expect(sessionsRepo.findActiveByTokenHash).toHaveBeenCalledWith(hashToken("tok"));
  });

  it("rejects an unknown or expired session as unauthorized", async () => {
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(null);

    await expect(service.authenticate(request())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lets a database failure through instead of reporting it as unauthorized", async () => {
    const failure = new Error("connection terminated");
    sessionsRepo.findActiveByTokenHash.mockRejectedValue(failure);

    await expect(service.authenticate(request())).rejects.toBe(failure);
  });

  it("does not write when the session was extended less than a day ago", async () => {
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(session(2 * DAY, SESSION_IDLE_LIFETIME_MS - 12 * 60 * 60 * 1000));

    await service.authenticate(request());

    expect(sessionsRepo.extend).not.toHaveBeenCalled();
  });

  it("extends a session in use by another idle period", async () => {
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(session(5 * DAY, 2 * DAY));

    const { session: renewed } = await service.authenticate(request());

    const expected = new Date(NOW + SESSION_IDLE_LIFETIME_MS);
    expect(sessionsRepo.extend).toHaveBeenCalledWith("session-1", expected);
    expect(renewed.expiresAt).toEqual(expected);
  });

  it("never extends past the absolute lifetime", async () => {
    const createdAgo = SESSION_ABSOLUTE_LIFETIME_MS - 3 * DAY;
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(session(createdAgo, DAY));

    await service.authenticate(request());

    expect(sessionsRepo.extend).toHaveBeenCalledWith("session-1", new Date(NOW + 3 * DAY));
  });

  it("does not extend a session that has reached its absolute lifetime", async () => {
    const createdAgo = SESSION_ABSOLUTE_LIFETIME_MS - DAY / 2;
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(session(createdAgo, DAY / 2));

    await service.authenticate(request());

    expect(sessionsRepo.extend).not.toHaveBeenCalled();
  });

  it("keeps the request authenticated when the extension fails", async () => {
    const current = session(5 * DAY, 2 * DAY);
    sessionsRepo.findActiveByTokenHash.mockResolvedValue(current);
    sessionsRepo.extend.mockRejectedValue(new Error("write failed"));

    const result = await service.authenticate(request());

    expect(result.session).toBe(current);
    expect(result.user).toEqual({ id: "user-1", isActive: true });
  });
});
