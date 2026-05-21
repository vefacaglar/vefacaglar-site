import { FastifyRequest } from "fastify";
import { LogoutResponse } from "./logout.schema";
import { AuthService } from "../auth.service";
import { SessionsRepository } from "../sessions.repository";

export class LogoutHandler {
  constructor(
    private readonly sessionsRepo: SessionsRepository,
    private readonly auth: AuthService
  ) {}

  async handle(request: FastifyRequest): Promise<LogoutResponse> {
    const { session } = await this.auth.authenticate(request);

    await this.sessionsRepo.revoke(session.id);

    return {
      message: "Logged out successfully.",
    };
  }
}
