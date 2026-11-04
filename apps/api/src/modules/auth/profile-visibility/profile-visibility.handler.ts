import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { USERS_REPOSITORY } from "../auth.tokens";
import type { IUsersRepository } from "../users.repository.interface";
import {
  UpdateProfileVisibilityRequest,
  UpdateProfileVisibilityResponse,
} from "./profile-visibility.schema";

/** Toggles whether the signed-in user's games library is publicly visible. */
@injectable()
export class UpdateProfileVisibilityHandler {
  constructor(@inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository) {}

  async handle(
    request: FastifyRequest,
    body: UpdateProfileVisibilityRequest
  ): Promise<UpdateProfileVisibilityResponse> {
    const updated = await this.usersRepo.updateProfileVisibility(request.user!.id, body.isProfilePublic);
    return { isProfilePublic: updated.isProfilePublic };
  }
}
