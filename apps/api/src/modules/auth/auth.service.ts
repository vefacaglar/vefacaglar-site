import { FastifyRequest } from "fastify";
import { hashToken } from "./auth.utils";
import type { User } from "./users.repository";
import type { Session } from "./sessions.repository";
import { injectable, inject } from "tsyringe";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY } from "./auth.tokens";
import type { IUsersRepository } from "./users.repository.interface";
import type { ISessionsRepository } from "./sessions.repository.interface";

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
}
