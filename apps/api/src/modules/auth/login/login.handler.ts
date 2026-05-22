import { randomBytes } from "crypto";
import { LoginRequest, LoginResponse } from "./login.schema";
import { hashToken, verifyPassword } from "../auth.utils";
import { injectable, inject } from "tsyringe";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY } from "../auth.tokens";
import type { IUsersRepository } from "../users.repository.interface";
import type { ISessionsRepository } from "../sessions.repository.interface";
import { UnauthorizedError } from "../../../shared/http-errors";

@injectable()
export class LoginHandler {
  constructor(
    @inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository,
    @inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: ISessionsRepository
  ) {}

  async handle(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.usersRepo.findByEmail(request.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isValid = verifyPassword(request.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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
