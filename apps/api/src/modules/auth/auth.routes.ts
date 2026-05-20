import { FastifyInstance } from "fastify";
import { LoginRequest, LoginRequestSchema, LoginResponseSchema } from "./login/login.schema";
import { LoginHandler } from "./login/login.handler";
import { MeResponseSchema } from "./me/me.schema";
import { MeHandler } from "./me/me.handler";
import { LogoutResponseSchema } from "./logout/logout.schema";
import { LogoutHandler } from "./logout/logout.handler";

export async function authRoutes(app: FastifyInstance) {
  const loginHandler = new LoginHandler();
  const meHandler = new MeHandler();
  const logoutHandler = new LogoutHandler();

  // POST /login
  app.post<{ Body: LoginRequest }>(
    "/login",
    {
      schema: {
        description: "User login to retrieve a session token",
        tags: ["Auth"],
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
          400: {
            type: "object",
            properties: { message: { type: "string" } },
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
          },
          500: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await loginHandler.handle(request.body);
        return result;
      } catch (error: any) {
        if (error.message === "InvalidCredentials") {
          return reply.status(401).send({ message: "Geçersiz e-posta veya şifre." });
        }
        console.error(error);
        return reply.status(500).send({ message: "Giriş işlemi sırasında bir hata oluştu." });
      }
    }
  );

  // GET /me
  app.get(
    "/me",
    {
      schema: {
        description: "Get current user profile information",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: MeResponseSchema,
          401: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await meHandler.handle(request);
        return result;
      } catch (error) {
        return reply.status(401).send({ message: "Yetkisiz erişim. Lütfen oturum açın." });
      }
    }
  );

  // POST /logout
  app.post(
    "/logout",
    {
      schema: {
        description: "Revoke the current session token",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: LogoutResponseSchema,
          401: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await logoutHandler.handle(request);
        return result;
      } catch (error) {
        return reply.status(401).send({ message: "Yetkisiz işlem." });
      }
    }
  );
}
