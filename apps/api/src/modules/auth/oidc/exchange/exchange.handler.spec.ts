import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OidcExchangeHandler } from "./exchange.handler";
import { AuthService } from "../../auth.service";
import type { IUsersRepository } from "../../users.repository.interface";
import type { IOidcClient, OidcClaims } from "../oidc-client.interface";
import { UnauthorizedError } from "../../../../shared/http-errors";

const ISSUER = "https://auth.server.com";

const claims: OidcClaims = {
  issuer: ISSUER,
  subject: "sub-1",
  email: "vefa@example.com",
  emailVerified: true,
  name: "Vefa Çağlar",
  preferredUsername: "Vefa.Caglar",
};

const session = { token: "tok", user: { id: "user-1", email: "vefa@example.com", displayName: "Vefa", role: "admin" } };

describe("OidcExchangeHandler", () => {
  let oidcClient: Record<keyof IOidcClient, any>;
  let usersRepo: Record<keyof IUsersRepository, any>;
  let authService: Record<string, any>;
  let handler: OidcExchangeHandler;

  beforeEach(() => {
    oidcClient = { verifyIdToken: vi.fn().mockResolvedValue(claims) };
    usersRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByUsername: vi.fn().mockResolvedValue(null),
      findByOidcSubject: vi.fn().mockResolvedValue(null),
      linkOidc: vi.fn(),
      create: vi.fn(),
      updateLastLogin: vi.fn(),
      updateProfile: vi.fn(),
      changePasswordAndRevokeOtherSessions: vi.fn(),
    };
    authService = { createSession: vi.fn().mockResolvedValue(session) };
    handler = new OidcExchangeHandler(
      oidcClient as unknown as IOidcClient,
      usersRepo as unknown as IUsersRepository,
      authService as unknown as AuthService
    );
  });

  it("creates a session for a user already linked to the subject", async () => {
    const user = { id: "user-1", isActive: true };
    usersRepo.findByOidcSubject.mockResolvedValue(user);

    const result = await handler.handle({ idToken: "jwt", nonce: "n1" });

    expect(oidcClient.verifyIdToken).toHaveBeenCalledWith("jwt", "n1");
    expect(usersRepo.findByOidcSubject).toHaveBeenCalledWith(ISSUER, "sub-1");
    expect(authService.createSession).toHaveBeenCalledWith(user);
    expect(usersRepo.updateLastLogin).toHaveBeenCalledWith("user-1");
    expect(usersRepo.create).not.toHaveBeenCalled();
    expect(result).toEqual(session);
  });

  it("links an existing local account by verified email", async () => {
    const existing = { id: "user-1", isActive: true, oidcSubject: null };
    const linked = { ...existing, oidcSubject: "sub-1" };
    usersRepo.findByEmail.mockResolvedValue(existing);
    usersRepo.linkOidc.mockResolvedValue(linked);

    await handler.handle({ idToken: "jwt", nonce: "n1" });

    expect(usersRepo.linkOidc).toHaveBeenCalledWith("user-1", ISSUER, "sub-1");
    expect(authService.createSession).toHaveBeenCalledWith(linked);
  });

  it("refuses to link by an unverified email", async () => {
    oidcClient.verifyIdToken.mockResolvedValue({ ...claims, emailVerified: false });
    usersRepo.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, oidcSubject: null });

    await expect(handler.handle({ idToken: "jwt", nonce: "n1" })).rejects.toThrow("has not verified");
    expect(usersRepo.linkOidc).not.toHaveBeenCalled();
    expect(authService.createSession).not.toHaveBeenCalled();
  });

  it("refuses to link an account already bound to another subject", async () => {
    usersRepo.findByEmail.mockResolvedValue({ id: "user-1", isActive: true, oidcSubject: "other" });

    await expect(handler.handle({ idToken: "jwt", nonce: "n1" })).rejects.toThrow(UnauthorizedError);
    expect(usersRepo.linkOidc).not.toHaveBeenCalled();
  });

  it("creates a new user with the non-admin default role", async () => {
    const created = { id: "user-2", isActive: true };
    usersRepo.create.mockResolvedValue(created);

    await handler.handle({ idToken: "jwt", nonce: "n1" });

    expect(usersRepo.create).toHaveBeenCalledWith({
      email: "vefa@example.com",
      username: "vefa.caglar",
      displayName: "Vefa Çağlar",
      passwordHash: null,
      role: "user",
      oidcIssuer: ISSUER,
      oidcSubject: "sub-1",
    });
    expect(authService.createSession).toHaveBeenCalledWith(created);
  });

  it("appends a number when the username is taken", async () => {
    usersRepo.findByUsername.mockImplementation(async (name: string) =>
      name === "vefa.caglar" ? { id: "x" } : null
    );
    usersRepo.create.mockResolvedValue({ id: "user-2", isActive: true });

    await handler.handle({ idToken: "jwt", nonce: "n1" });

    expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({ username: "vefa.caglar2" }));
  });

  it("rejects when the provider returns no email for an unknown subject", async () => {
    oidcClient.verifyIdToken.mockResolvedValue({ ...claims, email: undefined });

    await expect(handler.handle({ idToken: "jwt", nonce: "n1" })).rejects.toThrow(UnauthorizedError);
    expect(usersRepo.create).not.toHaveBeenCalled();
  });

  it("rejects a disabled account", async () => {
    usersRepo.findByOidcSubject.mockResolvedValue({ id: "user-1", isActive: false });

    await expect(handler.handle({ idToken: "jwt", nonce: "n1" })).rejects.toThrow("This account is disabled.");
    expect(authService.createSession).not.toHaveBeenCalled();
  });

  it("propagates token verification failures", async () => {
    oidcClient.verifyIdToken.mockRejectedValue(new UnauthorizedError("Invalid identity token."));

    await expect(handler.handle({ idToken: "bad", nonce: "n1" })).rejects.toThrow("Invalid identity token.");
    expect(usersRepo.findByOidcSubject).not.toHaveBeenCalled();
  });
});
