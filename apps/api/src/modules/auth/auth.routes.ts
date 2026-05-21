import { FastifyInstance } from "fastify";
import { LoginRequest, LoginRequestSchema, LoginResponseSchema } from "./login/login.schema";
import { LoginHandler } from "./login/login.handler";
import { MeResponseSchema } from "./me/me.schema";
import { MeHandler } from "./me/me.handler";
import { LogoutResponseSchema } from "./logout/logout.schema";
import { LogoutHandler } from "./logout/logout.handler";
import {
  GetProfileResponseSchema,
  UpdateProfileRequest,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
  ChangePasswordRequest,
  ChangePasswordRequestSchema,
  ChangePasswordResponseSchema,
} from "./profile/profile.schema";
import { ProfileHandler } from "./profile/profile.handler";

export async function authRoutes(app: FastifyInstance) {
  const loginHandler = new LoginHandler();
  const meHandler = new MeHandler();
  const logoutHandler = new LogoutHandler();
  const profileHandler = new ProfileHandler();

  // POST /login
  app.post<{ Body: LoginRequest }>(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
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

  // GET /profile
  app.get(
    "/profile",
    {
      schema: {
        description: "Get current user's full profile",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: GetProfileResponseSchema,
          401: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await profileHandler.getProfile(request);
        return result;
      } catch (error) {
        return reply.status(401).send({ message: "Unauthorized. Please log in." });
      }
    }
  );

  // PUT /profile
  app.put<{ Body: UpdateProfileRequest }>(
    "/profile",
    {
      schema: {
        description: "Update current user's profile information",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        body: UpdateProfileRequestSchema,
        response: {
          200: UpdateProfileResponseSchema,
          400: {
            type: "object",
            properties: { message: { type: "string" } },
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await profileHandler.updateProfile(request, request.body);
        return result;
      } catch (error: any) {
        if (error.message === "EmailAlreadyExists") {
          return reply.status(400).send({ message: "This email address is already in use." });
        }
        if (error.message === "UsernameAlreadyExists") {
          return reply.status(400).send({ message: "This username is already in use." });
        }
        if (error.message === "Unauthorized") {
          return reply.status(401).send({ message: "Unauthorized. Please log in." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while updating the profile." });
      }
    }
  );

  // PUT /profile/password
  app.put<{ Body: ChangePasswordRequest }>(
    "/profile/password",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
      schema: {
        description: "Change current user's password",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        body: ChangePasswordRequestSchema,
        response: {
          200: ChangePasswordResponseSchema,
          400: {
            type: "object",
            properties: { message: { type: "string" } },
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await profileHandler.changePassword(request, request.body);
        return result;
      } catch (error: any) {
        if (error.message === "InvalidCurrentPassword") {
          return reply.status(400).send({ message: "Current password is incorrect." });
        }
        if (error.message === "Unauthorized") {
          return reply.status(401).send({ message: "Unauthorized. Please log in." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while changing the password." });
      }
    }
  );
}
