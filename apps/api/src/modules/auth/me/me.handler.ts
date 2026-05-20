import { FastifyRequest } from "fastify";
import { MeResponse } from "./me.schema";
import { authenticateRequest } from "../auth.utils";

export class MeHandler {
  async handle(request: FastifyRequest): Promise<MeResponse> {
    const { user } = await authenticateRequest(request);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }
}
