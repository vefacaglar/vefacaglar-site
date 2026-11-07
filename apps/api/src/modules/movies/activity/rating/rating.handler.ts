import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { BadRequestError, NotFoundError } from "../../../../shared/http-errors";
import { MOVIE_ACTIVITY_REPOSITORY } from "../activity.tokens";
import type { IMovieActivityRepository } from "../activity.repository.interface";
import type { MovieActivityParams, MovieRatingBody } from "./rating.schema";
@injectable()
export class SetMovieRatingHandler {
  constructor(@inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieActivityParams; Body: MovieRatingBody }>): Promise<MovieRatingBody> {
    const { rating } = request.body;
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw new BadRequestError("err_movie_rating");
    const movieId = await this.repo.findPublicMovieId(request.params.slug);
    if (!movieId) throw new NotFoundError("err_movie_not_found");
    await this.repo.setRating(request.user!.id, movieId, rating);
    return { rating };
  }
}
