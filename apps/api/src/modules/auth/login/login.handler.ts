import { randomBytes } from "crypto";
import { LoginRequest, LoginResponse } from "./login.schema";
import { hashToken, verifyPassword } from "../auth.utils";
import { UsersRepository } from "../users.repository";
import { SessionsRepository } from "../sessions.repository";

export class LoginHandler {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly sessionsRepo: SessionsRepository
  ) {}

  async handle(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.usersRepo.findByEmail(request.email);

    if (!user || !user.isActive) {
      throw new Error("InvalidCredentials");
    }

    const isValid = verifyPassword(request.password, user.passwordHash);
    if (!isValid) {
      throw new Error("InvalidCredentials");
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
