import { FastifyRequest } from "fastify";
import { LogoutResponse } from "./logout.schema";
import { injectable, inject } from "tsyringe";
import { SESSIONS_REPOSITORY } from "../auth.tokens";
import type { ISessionsRepository } from "../sessions.repository.interface";

@injectable()
export class LogoutHandler {
  constructor(@inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: ISessionsRepository) {}

  async handle(request: FastifyRequest): Promise<LogoutResponse> {
    const session = request.session!;

    await this.sessionsRepo.revoke(session.id);

    return { message: "Logged out successfully." };
  }
}
