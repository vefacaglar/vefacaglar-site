import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { UpdateProfileVisibilityHandler } from "./profile-visibility.handler";
import type { IUsersRepository } from "../users.repository.interface";

describe("UpdateProfileVisibilityHandler", () => {
  let usersRepo: Record<keyof IUsersRepository, any>;
  let handler: UpdateProfileVisibilityHandler;
  const request = { user: { id: "user-1", isProfilePublic: false } } as unknown as FastifyRequest;

  beforeEach(() => {
    usersRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      findByOidcSubject: vi.fn(),
      linkOidc: vi.fn(),
      create: vi.fn(),
      updateLastLogin: vi.fn(),
      updateProfile: vi.fn(),
      updateProfileVisibility: vi.fn(),
      changePasswordAndRevokeOtherSessions: vi.fn(),
    };
    handler = new UpdateProfileVisibilityHandler(usersRepo as unknown as IUsersRepository);
  });

  it("makes the signed-in user's profile public", async () => {
    usersRepo.updateProfileVisibility.mockResolvedValue({ id: "user-1", isProfilePublic: true });

    const result = await handler.handle(request, { isProfilePublic: true });

    expect(usersRepo.updateProfileVisibility).toHaveBeenCalledWith("user-1", true);
    expect(result).toEqual({ isProfilePublic: true });
  });

  it("makes the signed-in user's profile private", async () => {
    usersRepo.updateProfileVisibility.mockResolvedValue({ id: "user-1", isProfilePublic: false });

    const result = await handler.handle(request, { isProfilePublic: false });

    expect(usersRepo.updateProfileVisibility).toHaveBeenCalledWith("user-1", false);
    expect(result).toEqual({ isProfilePublic: false });
  });
});
