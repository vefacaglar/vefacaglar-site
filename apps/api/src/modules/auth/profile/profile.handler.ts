import { FastifyRequest } from "fastify";
import { hashPassword, verifyPassword } from "../auth.utils";
import { injectable, inject } from "tsyringe";
import { USERS_REPOSITORY } from "../auth.tokens";
import type { IUsersRepository } from "../users.repository.interface";
import { BadRequestError } from "../../../shared/http-errors";
import {
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from "./profile.schema";

@injectable()
export class ProfileHandler {
  constructor(@inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository) {}

  async getProfile(request: FastifyRequest): Promise<GetProfileResponse> {
    const user = request.user!;

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
    const user = request.user!;

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
          throw new BadRequestError("This email address is already in use.");
        }
        if (target.includes("username")) {
          throw new BadRequestError("This username is already in use.");
        }
      }
      throw error;
    }
  }

  async changePassword(
    request: FastifyRequest,
    body: ChangePasswordRequest
  ): Promise<ChangePasswordResponse> {
    const user = request.user!;
    const session = request.session!;

    const isValid = verifyPassword(body.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestError("Current password is incorrect.");
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
