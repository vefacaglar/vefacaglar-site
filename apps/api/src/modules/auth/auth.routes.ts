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
import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function authRoutes(app: FastifyInstance) {
  const loginHandler = container.resolve(LoginHandler);
  const meHandler = container.resolve(MeHandler);
  const logoutHandler = container.resolve(LogoutHandler);
  const profileHandler = container.resolve(ProfileHandler);

  app.post<{ Body: LoginRequest }>("/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: {
      description: "User login to retrieve a session token",
      tags: ["Auth"],
      body: LoginRequestSchema,
      response: { 200: LoginResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => loginHandler.handle(request.body));

  app.get("/me", {
    preHandler: app.requireAuth,
    schema: {
      description: "Get current user profile information",
      tags: ["Auth"],
      security: [{ bearerAuth: [] }],
      response: { 200: MeResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => meHandler.handle(request));

  app.post("/logout", {
    preHandler: app.requireAuth,
    schema: {
      description: "Revoke the current session token",
      tags: ["Auth"],
      security: [{ bearerAuth: [] }],
      response: { 200: LogoutResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => logoutHandler.handle(request));

  app.get("/profile", {
    preHandler: app.requireAuth,
    schema: {
      description: "Get current user's full profile",
      tags: ["Auth"],
      security: [{ bearerAuth: [] }],
      response: { 200: GetProfileResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => profileHandler.getProfile(request));

  app.put<{ Body: UpdateProfileRequest }>("/profile", {
    preHandler: app.requireAuth,
    schema: {
      description: "Update current user's profile information",
      tags: ["Auth"],
      security: [{ bearerAuth: [] }],
      body: UpdateProfileRequestSchema,
      response: { 200: UpdateProfileResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => profileHandler.updateProfile(request, request.body));

  app.put<{ Body: ChangePasswordRequest }>("/profile/password", {
    preHandler: app.requireAuth,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: {
      description: "Change current user's password",
      tags: ["Auth"],
      security: [{ bearerAuth: [] }],
      body: ChangePasswordRequestSchema,
      response: { 200: ChangePasswordResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => profileHandler.changePassword(request, request.body));
}
