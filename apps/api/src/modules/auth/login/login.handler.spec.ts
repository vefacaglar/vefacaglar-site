import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginHandler } from "./login.handler";
import { AuthService } from "../auth.service";
import { UnauthorizedError } from "../../../shared/http-errors";
import type { LoginRequest, LoginResponse } from "./login.schema";

describe("LoginHandler", () => {
  let mockAuthService: Record<string, any>;
  let handler: LoginHandler;

  beforeEach(() => {
    mockAuthService = {
      login: vi.fn(),
    };
    handler = new LoginHandler(mockAuthService as unknown as AuthService);
  });

  it("should delegate login to AuthService and return its result", async () => {
    const request: LoginRequest = {
      email: "vefa@example.com",
      password: "supersecret",
    };

    const expected: LoginResponse = {
      token: "abc.def.ghi",
      user: {
        id: "user-1",
        email: "vefa@example.com",
        displayName: "Vefa Çağlar",
        role: "admin",
      },
    };

    mockAuthService.login.mockResolvedValue(expected);

    const result = await handler.handle(request);

    expect(mockAuthService.login).toHaveBeenCalledWith("vefa@example.com", "supersecret");
    expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expected);
  });

  it("should propagate UnauthorizedError thrown by AuthService", async () => {
    mockAuthService.login.mockRejectedValue(new UnauthorizedError("Invalid email or password."));

    const request: LoginRequest = {
      email: "wrong@example.com",
      password: "badpass",
    };

    await expect(handler.handle(request)).rejects.toThrow(UnauthorizedError);
    await expect(handler.handle(request)).rejects.toThrow("Invalid email or password.");
  });

  it("should propagate any other error from AuthService without wrapping", async () => {
    const boom = new Error("db down");
    mockAuthService.login.mockRejectedValue(boom);

    await expect(
      handler.handle({ email: "a@b.com", password: "x" } as LoginRequest)
    ).rejects.toBe(boom);
  });
});
