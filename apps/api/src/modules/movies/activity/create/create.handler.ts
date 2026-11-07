import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { ConflictError, NotFoundError } from "../../../../shared/http-errors";
import { MOVIE_ACTIVITY_REPOSITORY } from "../activity.tokens";
import type { IMovieActivityRepository } from "../activity.repository.interface";
import type { MovieWatch, MovieActivityParams, CreateMovieWatchBody } from "./create.schema";
import { toMovieWatch, validateWatchDate, normalizeWatchComment } from "../activity.values";
@injectable()
export class CreateMovieWatchHandler {
  constructor(@inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieActivityParams; Body: CreateMovieWatchBody }>): Promise<MovieWatch> {
    const watchedOn = validateWatchDate(request.body.watchedOn);
    const comment = normalizeWatchComment(request.body.comment);
    const movieId = await this.repo.findPublicMovieId(request.params.slug);
    if (!movieId) throw new NotFoundError("err_movie_not_found");
    const watch = await this.repo.createWatch(request.user!.id, movieId, request.body.id, watchedOn, comment);
    if (!watch) throw new ConflictError("err_movie_watch_conflict");
    return toMovieWatch(watch);
  }
}
