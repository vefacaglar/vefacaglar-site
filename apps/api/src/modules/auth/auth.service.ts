import { FastifyRequest } from "fastify";
import { randomBytes } from "crypto";
import { hashToken, verifyPassword } from "./auth.utils";
import type { User } from "./users.repository";
import type { Session } from "./sessions.repository";
import { injectable, inject } from "tsyringe";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY } from "./auth.tokens";
import type { IUsersRepository } from "./users.repository.interface";
import type { ISessionsRepository } from "./sessions.repository.interface";
import { UnauthorizedError } from "../../shared/http-errors";

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
      throw new Error("Unauthorized");
    }

    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);

    const session = await this.sessionsRepo.findActiveByTokenHash(tokenHash);
    if (!session) {
      throw new Error("Unauthorized");
    }

    const user = await this.usersRepo.findById(session.userId);
    if (!user || !user.isActive) {
      throw new Error("Unauthorized");
    }

    return { user, session };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersRepo.findByEmail(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
}
