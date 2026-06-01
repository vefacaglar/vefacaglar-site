import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileHandler } from "./profile.handler";
import type { IUsersRepository } from "../users.repository.interface";
import { BadRequestError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";
import { hashPassword } from "../auth.utils";

describe("ProfileHandler", () => {
  let mockUsersRepo: Record<keyof IUsersRepository, any>;
  let handler: ProfileHandler;
  const baseUser = {
    id: "user-1",
    email: "vefa@example.com",
    username: "vefa",
    displayName: "Vefa Çağlar",
    role: "admin",
    passwordHash: "secret",
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  beforeEach(() => {
    mockUsersRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      updateLastLogin: vi.fn(),
      updateProfile: vi.fn(),
      changePasswordAndRevokeOtherSessions: vi.fn(),
    };
    handler = new ProfileHandler(mockUsersRepo as unknown as IUsersRepository);
  });

  describe("getProfile", () => {
    it("should return formatted user profile taken from request.user", async () => {
      const mockRequest = {
        user: baseUser,
      } as unknown as FastifyRequest;

      const result = await handler.getProfile(mockRequest);

      expect(result).toEqual({
        user: {
          id: "user-1",
          email: "vefa@example.com",
          username: "vefa",
          displayName: "Vefa Çağlar",
          role: "admin",
        },
      });
    });
  });

  describe("updateProfile", () => {
    it("should pass id and patch to the users repo and return the updated profile", async () => {
      const updated = {
        ...baseUser,
        email: "new@example.com",
        username: "vefa-new",
        displayName: "Vefa New",
        updatedAt: new Date("2026-02-02"),
      };
      mockUsersRepo.updateProfile.mockResolvedValue(updated);

      const mockRequest = {
        user: baseUser,
      } as unknown as FastifyRequest;

      const result = await handler.updateProfile(mockRequest, {
        email: "new@example.com",
        username: "vefa-new",
        displayName: "Vefa New",
      });

      expect(mockUsersRepo.updateProfile).toHaveBeenCalledWith("user-1", {
        email: "new@example.com",
        username: "vefa-new",
        displayName: "Vefa New",
      });
      expect(result).toEqual({
        user: {
          id: "user-1",
          email: "new@example.com",
          username: "vefa-new",
          displayName: "Vefa New",
          role: "admin",
        },
      });
    });

    it("should translate unique-constraint error on email to BadRequestError", async () => {
      const dbError: any = new Error("duplicate key");
      dbError.code = "23505";
      dbError.constraint_name = "users_email_unique";
      dbError.detail = "Key (email)=(vefa@example.com) already exists.";
      mockUsersRepo.updateProfile.mockRejectedValue(dbError);

      const mockRequest = {
        user: baseUser,
      } as unknown as FastifyRequest;

      await expect(
        handler.updateProfile(mockRequest, {
          email: "vefa@example.com",
          username: "vefa",
          displayName: "Vefa Çağlar",
        })
      ).rejects.toThrow(BadRequestError);
      await expect(
        handler.updateProfile(mockRequest, {
          email: "vefa@example.com",
          username: "vefa",
          displayName: "Vefa Çağlar",
        })
      ).rejects.toThrow("This email address is already in use.");
    });

    it("should translate unique-constraint error on username to BadRequestError", async () => {
      const dbError: any = new Error("duplicate key");
      dbError.code = "23505";
      dbError.constraint_name = "users_username_unique";
      dbError.detail = "Key (username)=(vefa) already exists.";
      mockUsersRepo.updateProfile.mockRejectedValue(dbError);

      const mockRequest = {
        user: baseUser,
      } as unknown as FastifyRequest;

      await expect(
        handler.updateProfile(mockRequest, {
          email: "vefa@example.com",
          username: "vefa",
          displayName: "Vefa Çağlar",
        })
      ).rejects.toThrow("This username is already in use.");
    });

    it("should re-throw non-constraint errors unchanged", async () => {
      const dbError = new Error("connection lost");
      mockUsersRepo.updateProfile.mockRejectedValue(dbError);

      const mockRequest = {
        user: baseUser,
      } as unknown as FastifyRequest;

      await expect(
        handler.updateProfile(mockRequest, {
          email: "vefa@example.com",
          username: "vefa",
          displayName: "Vefa Çağlar",
        })
      ).rejects.toThrow("connection lost");
    });
  });

  describe("changePassword", () => {
    it("should throw BadRequestError when current password does not match", async () => {
      const hashedOld = "salt:oldhash";
      const mockRequest = {
        user: { ...baseUser, passwordHash: hashedOld },
        session: { id: "session-1" },
      } as unknown as FastifyRequest;

      await expect(
        handler.changePassword(mockRequest, {
          currentPassword: "wrong-password",
          newPassword: "newsecret",
        })
      ).rejects.toThrow(BadRequestError);
      await expect(
        handler.changePassword(mockRequest, {
          currentPassword: "wrong-password",
          newPassword: "newsecret",
        })
      ).rejects.toThrow("Current password is incorrect.");

      expect(mockUsersRepo.changePasswordAndRevokeOtherSessions).not.toHaveBeenCalled();
    });

    it("should hash new password, persist it, and revoke other sessions on success", async () => {
      const hashedOld = hashPassword("currentpass");
      const mockRequest = {
        user: { ...baseUser, passwordHash: hashedOld },
        session: { id: "session-1" },
      } as unknown as FastifyRequest;

      mockUsersRepo.changePasswordAndRevokeOtherSessions.mockResolvedValue(undefined);

      const result = await handler.changePassword(mockRequest, {
        currentPassword: "currentpass",
        newPassword: "brand-new-pass",
      });

      expect(mockUsersRepo.changePasswordAndRevokeOtherSessions).toHaveBeenCalledTimes(1);
      const callArgs = mockUsersRepo.changePasswordAndRevokeOtherSessions.mock.calls[0];
      expect(callArgs[0]).toBe("user-1");
      expect(callArgs[1]).toBe("session-1");
      expect(callArgs[2]).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
      expect(callArgs[2]).not.toBe(hashedOld);
      expect(result).toEqual({ message: "Password updated successfully." });
    });
  });
});
