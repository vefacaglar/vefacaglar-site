import { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";
import { AuthService } from "./auth.service";
import { UsersRepository, type User } from "./users.repository";
import { SessionsRepository, type Session } from "./sessions.repository";

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
  const auth = new AuthService(new UsersRepository(), new SessionsRepository());

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user, session } = await auth.authenticate(request);
      request.user = user;
      request.session = session;
    } catch {
      return reply.status(401).send({ message: "Unauthorized. Please log in." });
    }
  };

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user, session } = await auth.authenticate(request);
      if (user.role !== "admin") {
        return reply.status(401).send({ message: "Unauthorized action. You must log in as admin." });
      }
      request.user = user;
      request.session = session;
    } catch {
      return reply.status(401).send({ message: "Unauthorized action. You must log in as admin." });
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
