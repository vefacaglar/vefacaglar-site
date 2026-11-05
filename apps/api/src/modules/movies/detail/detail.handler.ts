import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { MOVIES_REPOSITORY } from "../movies.tokens";
import type { IMoviesRepository } from "../movies.repository.interface";
import type { GetMovieParams, MovieDetail } from "./detail.schema";
@injectable()
export class GetMovieHandler {
  constructor(@inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository) {}
  async handle(request: FastifyRequest<{ Params: GetMovieParams }>): Promise<MovieDetail> {
    const movie = await this.repo.findPublicBySlug(request.params.slug);
    if (!movie) throw new NotFoundError("err_movie_not_found");
    return movie;
  }
}
