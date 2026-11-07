import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/http-errors";
import { MOVIE_ACTIVITY_REPOSITORY } from "../activity.tokens";
import type { IMovieActivityRepository } from "../activity.repository.interface";
import type { MovieWatch, MovieWatchParams, WatchDateBody } from "./update.schema";
import { toMovieWatch, validateWatchDate, normalizeWatchComment } from "../activity.values";
@injectable()
export class UpdateMovieWatchHandler {
  constructor(@inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieWatchParams; Body: WatchDateBody }>): Promise<MovieWatch> {
    const watchedOn = validateWatchDate(request.body.watchedOn);
    const comment = request.body.comment === undefined ? undefined : normalizeWatchComment(request.body.comment);
    const movieId = await this.repo.findPublicMovieId(request.params.slug);
    if (!movieId) throw new NotFoundError("err_movie_not_found");
    const watch = await this.repo.updateWatch(request.user!.id, movieId, request.params.id, watchedOn, comment, request.body.isPublic);
    if (!watch) throw new NotFoundError("err_movie_watch_not_found");
    return toMovieWatch(watch);
  }
}
