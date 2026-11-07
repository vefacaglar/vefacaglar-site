import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/http-errors";
import { MOVIE_ACTIVITY_REPOSITORY } from "../activity.tokens";
import type { IMovieActivityRepository } from "../activity.repository.interface";
import type { MovieActivity, MovieActivityParams, MovieActivityQuery } from "./get.schema";
import { toMovieWatch } from "../activity.values";
@injectable()
export class GetMovieActivityHandler {
  constructor(@inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieActivityParams; Querystring: MovieActivityQuery }>): Promise<MovieActivity> {
    const movieId = await this.repo.findPublicMovieId(request.params.slug);
    if (!movieId) throw new NotFoundError("err_movie_not_found");
    const page = request.query.page ?? 1, limit = request.query.limit ?? 20;
    const result = await this.repo.getActivity(request.user!.id, movieId, page, limit);
    return { ...result, watches: result.watches.map(toMovieWatch), page, limit, totalPages: Math.ceil(result.total / limit) };
  }
}
