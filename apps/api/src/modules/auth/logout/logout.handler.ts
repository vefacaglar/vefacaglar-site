import { FastifyRequest } from "fastify";
import { db, sessions } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { LogoutResponse } from "./logout.schema";
import { authenticateRequest } from "../auth.utils";

export class LogoutHandler {
  async handle(request: FastifyRequest): Promise<LogoutResponse> {
    const { session } = await authenticateRequest(request);

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id));

    return {
      message: "Logged out successfully.",
    };
  }
}
