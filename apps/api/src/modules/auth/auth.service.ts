import { FastifyRequest } from "fastify";
import { hashToken } from "./auth.utils";
import { UsersRepository, type User } from "./users.repository";
import { SessionsRepository, type Session } from "./sessions.repository";

export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly sessionsRepo: SessionsRepository
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
}
