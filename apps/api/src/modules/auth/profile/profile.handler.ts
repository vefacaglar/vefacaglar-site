import { FastifyRequest } from "fastify";
import { db, users } from "@vefacaglar/db";
import { eq, and, ne } from "drizzle-orm";
import { authenticateRequest, verifyPassword, hashPassword } from "../auth.utils";
import {
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from "./profile.schema";

export class ProfileHandler {
  async getProfile(request: FastifyRequest): Promise<GetProfileResponse> {
    const { user } = await authenticateRequest(request);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  async updateProfile(
    request: FastifyRequest,
    body: UpdateProfileRequest
  ): Promise<UpdateProfileResponse> {
    const { user } = await authenticateRequest(request);

    try {
      const updated = await db.transaction(async (tx) => {
        const emailExists = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, body.email), ne(users.id, user.id)))
          .limit(1);

        if (emailExists.length > 0) {
          throw new Error("EmailAlreadyExists");
        }

        const usernameExists = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, body.username), ne(users.id, user.id)))
          .limit(1);

        if (usernameExists.length > 0) {
          throw new Error("UsernameAlreadyExists");
        }

        const [row] = await tx
          .update(users)
          .set({
            email: body.email,
            username: body.username,
            displayName: body.displayName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();

        return row;
      });

      return {
        user: {
          id: updated.id,
          email: updated.email,
          username: updated.username,
          displayName: updated.displayName,
          role: updated.role,
        },
      };
    } catch (error: any) {
      if (error?.code === "23505") {
        const target = `${error.constraint_name ?? ""} ${error.detail ?? ""}`;
        if (target.includes("email")) {
          throw new Error("EmailAlreadyExists");
        }
        if (target.includes("username")) {
          throw new Error("UsernameAlreadyExists");
        }
      }
      throw error;
    }
  }

  async changePassword(
    request: FastifyRequest,
    body: ChangePasswordRequest
  ): Promise<ChangePasswordResponse> {
    const { user } = await authenticateRequest(request);

    const isValid = verifyPassword(body.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("InvalidCurrentPassword");
    }

    const newPasswordHash = hashPassword(body.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { message: "Password updated successfully." };
  }
}
