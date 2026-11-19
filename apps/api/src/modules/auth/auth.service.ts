import { FastifyRequest } from "fastify";
import { randomBytes } from "crypto";
import { hashPassword, hashToken, verifyPassword } from "./auth.utils";
import type { User } from "./users.repository";
import type { Session } from "./sessions.repository";
import { injectable, inject } from "tsyringe";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY } from "./auth.tokens";
import type { IUsersRepository } from "./users.repository.interface";
import type { ISessionsRepository } from "./sessions.repository.interface";
import { UnauthorizedError } from "../../shared/http-errors";
import { reportRuntimeFailure } from "../../shared/application-logs/runtime-failures";

/** Verified against when no usable account exists, so unknown emails cost the same scrypt work as real ones. */
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(16).toString("hex"));

const DAY_MS = 24 * 60 * 60 * 1000;
/** A session expires after this long without use. */
export const SESSION_IDLE_LIFETIME_MS = 7 * DAY_MS;
/** A session never outlives this, however often it is used. Web session cookies last this long. */
export const SESSION_ABSOLUTE_LIFETIME_MS = 30 * DAY_MS;
/** Expiry is pushed forward at most once per this interval, so most requests do not write. */
const SESSION_RENEW_INTERVAL_MS = DAY_MS;

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
}

@injectable()
export class AuthService {
  constructor(
    @inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository,
    @inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: ISessionsRepository
  ) {}

  async authenticate(request: FastifyRequest): Promise<{ user: User; session: Session }> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Unauthorized", "A bearer token is required");
    }

    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);

    const session = await this.sessionsRepo.findActiveByTokenHash(tokenHash);
    if (!session) {
      throw new UnauthorizedError("Unauthorized", "The session token is invalid or expired");
    }

    const user = await this.usersRepo.findById(session.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Unauthorized", "The session belongs to a missing or disabled account");
    }

    return { user, session: await this.renewIfDue(session) };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersRepo.findByEmail(email);

    if (!user || !user.isActive) {
      verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (!user.passwordHash) {
      verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    return this.createSession(user);
  }

  async createSession(user: User): Promise<LoginResult> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_IDLE_LIFETIME_MS);

    await this.sessionsRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await this.usersRepo.updateLastLogin(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  /**
   * Sliding expiry: a session in use keeps living for another idle period, up to
   * its absolute lifetime. A failed renewal never fails the request; the session
   * is still valid until its current expiry.
   */
  private async renewIfDue(session: Session): Promise<Session> {
    const now = Date.now();
    const expiresAt = Math.min(now + SESSION_IDLE_LIFETIME_MS, session.createdAt.getTime() + SESSION_ABSOLUTE_LIFETIME_MS);
    if (expiresAt - session.expiresAt.getTime() < SESSION_RENEW_INTERVAL_MS) return session;

    try {
      await this.sessionsRepo.extend(session.id, new Date(expiresAt));
      return { ...session, expiresAt: new Date(expiresAt) };
    } catch (error) {
      reportRuntimeFailure("session_renewal_failed", "Session expiry could not be extended", error, "warning");
      return session;
    }
  }
}
