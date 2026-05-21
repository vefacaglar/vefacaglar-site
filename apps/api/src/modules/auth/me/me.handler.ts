import { FastifyRequest } from "fastify";
import { MeResponse } from "./me.schema";

export class MeHandler {
  async handle(request: FastifyRequest): Promise<MeResponse> {
    const user = request.user!;

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
