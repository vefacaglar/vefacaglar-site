import { FastifyRequest } from "fastify";
import { MeResponse } from "./me.schema";
import { AuthService } from "../auth.service";

export class MeHandler {
  constructor(private readonly auth: AuthService) {}

  async handle(request: FastifyRequest): Promise<MeResponse> {
    const { user } = await this.auth.authenticate(request);

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
