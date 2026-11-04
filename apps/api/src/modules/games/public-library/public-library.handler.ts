import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { GAME_LOGS_REPOSITORY } from "../games.tokens";
import type { IGameLogsRepository } from "../game-logs.repository.interface";
import { USERS_REPOSITORY } from "../../auth/auth.tokens";
import type { IUsersRepository } from "../../auth/users.repository.interface";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../shared/http-errors";
import { buildLibrary } from "../library-stats";
import { PublicLibraryParams, PublicLibraryResponse } from "./public-library.schema";

/** A user's games library: visible to everyone when public, and always to its owner. */
@injectable()
export class GetPublicLibraryHandler {
  constructor(
    @inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository,
    @inject(GAME_LOGS_REPOSITORY) private readonly logsRepo: IGameLogsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: PublicLibraryParams }>): Promise<PublicLibraryResponse> {
    const user = await this.usersRepo.findByUsername(request.params.username);
    if (!user || !user.isActive) {
      throw new NotFoundError("err_profile_not_found");
    }

    // Set by the optional-auth preHandler; undefined for anonymous visitors (or an invalid token).
    const viewerId = request.user?.id;
    const isOwner = viewerId === user.id;
    if (!user.isProfilePublic && !isOwner) {
      // Anonymous visitors may be the owner once signed in (401); anyone else signed in never may (403).
      throw viewerId ? new ForbiddenError("err_profile_private") : new UnauthorizedError("err_profile_private");
    }

    const [logs, playtimeActivity] = await Promise.all([
      this.logsRepo.listForUser(user.id),
      this.logsRepo.listPlaytimeActivityForUser(user.id),
    ]);

    return {
      user: { username: user.username, displayName: user.displayName, isProfilePublic: user.isProfilePublic },
      isOwner,
      ...buildLibrary(logs, playtimeActivity),
    };
  }
}
