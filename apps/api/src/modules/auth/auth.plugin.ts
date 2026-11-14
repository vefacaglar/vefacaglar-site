import { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { AuthService } from "./auth.service";
import type { User } from "./users.repository";
import type { Session } from "./sessions.repository";
import { UnauthorizedError } from "../../shared/http-errors";
import { container } from "../../container";
import { reportRuntimeFailure } from "../../shared/application-logs/runtime-failures";

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

  // Only a rejected credential is a 401. Anything else (e.g. the database being
  // unreachable) stays a 5xx so clients do not mistake an outage for a logout.
  const asUnauthorized = (message: string) => (cause: unknown): never => {
    if (cause instanceof UnauthorizedError) throw new UnauthorizedError(message, undefined, { cause });
    throw cause;
  };

  const requireAuth = async (request: FastifyRequest) => {
    const { user, session } = await auth.authenticate(request).catch(asUnauthorized("Unauthorized. Please log in."));
    request.user = user;
    request.session = session;
  };

  const requireAdmin = async (request: FastifyRequest) => {
    const { user, session } = await auth
      .authenticate(request)
      .catch(asUnauthorized("Unauthorized action. You must log in as admin."));
    if (user.role !== "admin") {
      throw new UnauthorizedError("Unauthorized action. You must log in as admin.", "The account does not have the admin role");
    }
    request.user = user;
    request.session = session;
  };

  const tryAuth = async (request: FastifyRequest) => {
    try {
      const { user, session } = await auth.authenticate(request);
      request.user = user;
      request.session = session;
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        reportRuntimeFailure("optional_auth_failed", "Optional authentication failed. Continuing without a session", error, "warning");
      }
    }
  };

  app.decorate("requireAuth", requireAuth);
  app.decorate("requireAdmin", requireAdmin);
  app.decorate("tryAuth", tryAuth);
}
