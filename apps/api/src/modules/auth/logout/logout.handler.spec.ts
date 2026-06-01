import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogoutHandler } from "./logout.handler";
import type { ISessionsRepository } from "../sessions.repository.interface";
import { FastifyRequest } from "fastify";

describe("LogoutHandler", () => {
  let mockSessionsRepo: Record<keyof ISessionsRepository, any>;
  let handler: LogoutHandler;

  beforeEach(() => {
    mockSessionsRepo = {
      create: vi.fn(),
      findActiveByTokenHash: vi.fn(),
      revoke: vi.fn(),
    };
    handler = new LogoutHandler(mockSessionsRepo as unknown as ISessionsRepository);
  });

  it("should revoke the active session taken from the request and return success message", async () => {
    mockSessionsRepo.revoke.mockResolvedValue(undefined);

    const mockRequest = {
      session: { id: "session-abc" },
    } as unknown as FastifyRequest;

    const result = await handler.handle(mockRequest);

    expect(mockSessionsRepo.revoke).toHaveBeenCalledWith("session-abc");
    expect(mockSessionsRepo.revoke).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: "Logged out successfully." });
  });

  it("should propagate any error from sessions repository", async () => {
    mockSessionsRepo.revoke.mockRejectedValue(new Error("db failure"));

    const mockRequest = {
      session: { id: "session-abc" },
    } as unknown as FastifyRequest;

    await expect(handler.handle(mockRequest)).rejects.toThrow("db failure");
  });
});
