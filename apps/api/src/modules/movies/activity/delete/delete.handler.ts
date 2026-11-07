import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/http-errors";
import { MOVIE_ACTIVITY_REPOSITORY } from "../activity.tokens";
import type { IMovieActivityRepository } from "../activity.repository.interface";
import type { MovieWatchParams } from "./delete.schema";
@injectable()
export class DeleteMovieWatchHandler {
  constructor(@inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieWatchParams }>): Promise<void> {
    const movieId = await this.repo.findPublicMovieId(request.params.slug);
    if (!movieId) throw new NotFoundError("err_movie_not_found");
    if (!await this.repo.deleteWatch(request.user!.id, movieId, request.params.id)) throw new NotFoundError("err_movie_watch_not_found");
  }
}
