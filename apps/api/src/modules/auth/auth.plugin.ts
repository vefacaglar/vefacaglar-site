import { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { AuthService } from "./auth.service";
import type { User } from "./users.repository";
import type { Session } from "./sessions.repository";
import { UnauthorizedError } from "../../shared/http-errors";
import { container } from "../../container";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    session?: Session;
  }
  interface FastifyInstance {
    requireAuth: preHandlerHookHandler;
    requireAdmin: preHandlerHookHandler;
    tryAuth: preHandlerHookHandler;
  }
}

export function registerAuthDecorators(app: FastifyInstance): void {
  const auth = container.resolve(AuthService);

  const requireAuth = async (request: FastifyRequest) => {
    try {
      const { user, session } = await auth.authenticate(request);
      request.user = user;
      request.session = session;
    } catch {
      throw new UnauthorizedError("Unauthorized. Please log in.");
    }
  };

  const requireAdmin = async (request: FastifyRequest) => {
    try {
      const { user, session } = await auth.authenticate(request);
      if (user.role !== "admin") {
        throw new UnauthorizedError("Unauthorized action. You must log in as admin.");
      }
      request.user = user;
      request.session = session;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError("Unauthorized action. You must log in as admin.");
    }
  };

  const tryAuth = async (request: FastifyRequest) => {
    try {
      const { user, session } = await auth.authenticate(request);
      request.user = user;
      request.session = session;
    } catch {
      // Public mode — leave request.user undefined
    }
  };

  app.decorate("requireAuth", requireAuth);
  app.decorate("requireAdmin", requireAdmin);
  app.decorate("tryAuth", tryAuth);
}
