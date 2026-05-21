import { FastifyRequest } from "fastify";
import { LogoutResponse } from "./logout.schema";
import { SessionsRepository } from "../sessions.repository";

export class LogoutHandler {
  constructor(private readonly sessionsRepo: SessionsRepository) {}

  async handle(request: FastifyRequest): Promise<LogoutResponse> {
    const session = request.session!;

    await this.sessionsRepo.revoke(session.id);

    return { message: "Logged out successfully." };
  }
}
