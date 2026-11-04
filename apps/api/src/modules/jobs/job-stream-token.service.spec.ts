import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import { JobStreamTokenService, readJobStreamTokenConfig } from "./job-stream-token.service";
import type { JobStreamTokenConfig } from "./job-stream-token.service.interface";
import type { IUsersRepository } from "../auth/users.repository.interface";
import type { User } from "../auth/users.repository";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_JOB_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SECRET = new TextEncoder().encode("test-secret-test-secret-test-secret!!");
const NOW = new Date("2026-11-04T12:00:00.000Z");

function createMockUsersRepo(): Record<keyof IUsersRepository, any> {
  return {
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
}

function user(overrides: Partial<User> = {}): User {
  return { id: USER_ID, role: "admin", isActive: true, ...overrides } as User;
}

describe("JobStreamTokenService", () => {
  let usersRepo: Record<keyof IUsersRepository, any>;
  let config: JobStreamTokenConfig;
  let service: JobStreamTokenService;

  beforeEach(() => {
    usersRepo = createMockUsersRepo();
    config = { secret: SECRET, ttlSeconds: 120, ephemeral: false };
    service = new JobStreamTokenService(usersRepo as unknown as IUsersRepository, config);
  });

  describe("sign", () => {
    it("issues an HS256 JWT with sub, jobId, scope, iat and exp = iat + 120 s", async () => {
      const { token, expiresAt } = await service.sign(USER_ID, JOB_ID, NOW);

      const claims = decodeJwt(token);
      expect(claims).toEqual({
        sub: USER_ID,
        jobId: JOB_ID,
        scope: "job-stream",
        iat: NOW.getTime() / 1000,
        exp: NOW.getTime() / 1000 + 120,
      });
      expect(JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
      expect(expiresAt.toISOString()).toBe("2026-11-04T12:02:00.000Z");
    });
  });

  describe("verify", () => {
    it("accepts a valid token for the same job", async () => {
      const { token } = await service.sign(USER_ID, JOB_ID, NOW);
      await expect(service.verify(token, JOB_ID, new Date(NOW.getTime() + 60_000))).resolves.toEqual({ userId: USER_ID });
    });

    it("rejects an expired token", async () => {
      const { token } = await service.sign(USER_ID, JOB_ID, NOW);
      await expect(service.verify(token, JOB_ID, new Date(NOW.getTime() + 121_000))).resolves.toBeNull();
    });

    it("rejects a token for another job", async () => {
      const { token } = await service.sign(USER_ID, JOB_ID, NOW);
      await expect(service.verify(token, OTHER_JOB_ID, NOW)).resolves.toBeNull();
    });

    it("rejects a wrong scope", async () => {
      const iat = NOW.getTime() / 1000;
      const token = await new SignJWT({ jobId: JOB_ID, scope: "session" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(USER_ID)
        .setIssuedAt(iat)
        .setExpirationTime(iat + 120)
        .sign(SECRET);
      await expect(service.verify(token, JOB_ID, NOW)).resolves.toBeNull();
    });

    it("rejects a token signed with another secret", async () => {
      const other = new JobStreamTokenService(usersRepo as unknown as IUsersRepository, {
        ...config,
        secret: new TextEncoder().encode("another-secret-another-secret-12345"),
      });
      const { token } = await other.sign(USER_ID, JOB_ID, NOW);
      await expect(service.verify(token, JOB_ID, NOW)).resolves.toBeNull();
    });

    it("rejects a tampered payload and garbage", async () => {
      const { token } = await service.sign(USER_ID, JOB_ID, NOW);
      const [header, , signature] = token.split(".");
      const forged = Buffer.from(JSON.stringify({ sub: USER_ID, jobId: OTHER_JOB_ID, scope: "job-stream", iat: 1, exp: 9_999_999_999 })).toString("base64url");
      await expect(service.verify(`${header}.${forged}.${signature}`, OTHER_JOB_ID, NOW)).resolves.toBeNull();
      await expect(service.verify("not-a-jwt", JOB_ID, NOW)).resolves.toBeNull();
    });

    it("rejects alg=none tokens", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({ sub: USER_ID, jobId: JOB_ID, scope: "job-stream", iat: NOW.getTime() / 1000, exp: NOW.getTime() / 1000 + 120 })
      ).toString("base64url");
      await expect(service.verify(`${header}.${payload}.`, JOB_ID, NOW)).resolves.toBeNull();
    });
  });

  describe("authorize", () => {
    it("returns the active admin user for a valid token", async () => {
      const { token } = await service.sign(USER_ID, JOB_ID);
      usersRepo.findById.mockResolvedValue(user());

      await expect(service.authorize(token, JOB_ID)).resolves.toMatchObject({ id: USER_ID });
      expect(usersRepo.findById).toHaveBeenCalledWith(USER_ID);
    });

    it.each([
      ["missing", null],
      ["inactive", user({ isActive: false })],
      ["no longer admin", user({ role: "user" })],
    ])("rejects a %s user", async (_label, row) => {
      const { token } = await service.sign(USER_ID, JOB_ID);
      usersRepo.findById.mockResolvedValue(row);
      await expect(service.authorize(token, JOB_ID)).resolves.toBeNull();
    });

    it("does not look up the user for an invalid token", async () => {
      const { token } = await service.sign(USER_ID, JOB_ID);
      await expect(service.authorize(token, OTHER_JOB_ID)).resolves.toBeNull();
      expect(usersRepo.findById).not.toHaveBeenCalled();
    });
  });
});

describe("readJobStreamTokenConfig", () => {
  it("uses JOB_STREAM_TOKEN_SECRET when set", () => {
    const config = readJobStreamTokenConfig({ JOB_STREAM_TOKEN_SECRET: "abc" });
    expect(config.ephemeral).toBe(false);
    expect(new TextDecoder().decode(config.secret)).toBe("abc");
    expect(config.ttlSeconds).toBe(120);
  });

  it("falls back to a random per-process key", () => {
    const a = readJobStreamTokenConfig({});
    const b = readJobStreamTokenConfig({ JOB_STREAM_TOKEN_SECRET: "  " });
    expect(a.ephemeral).toBe(true);
    expect(a.secret).toHaveLength(32);
    expect(Buffer.from(a.secret).equals(Buffer.from(b.secret))).toBe(false);
  });
});
