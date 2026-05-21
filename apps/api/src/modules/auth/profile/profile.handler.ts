import { FastifyRequest } from "fastify";
import { hashPassword, verifyPassword } from "../auth.utils";
import { AuthService } from "../auth.service";
import { UsersRepository } from "../users.repository";
import {
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from "./profile.schema";

export class ProfileHandler {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly auth: AuthService
  ) {}

  async getProfile(request: FastifyRequest): Promise<GetProfileResponse> {
    const { user } = await this.auth.authenticate(request);

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
    const { user } = await this.auth.authenticate(request);

    try {
      const updated = await this.usersRepo.updateProfile(user.id, {
        email: body.email,
        username: body.username,
        displayName: body.displayName,
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
    const { user, session } = await this.auth.authenticate(request);

    const isValid = verifyPassword(body.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("InvalidCurrentPassword");
    }

    const newPasswordHash = hashPassword(body.newPassword);

    await this.usersRepo.changePasswordAndRevokeOtherSessions(
      user.id,
      session.id,
      newPasswordHash
    );

    return { message: "Password updated successfully." };
  }
}
