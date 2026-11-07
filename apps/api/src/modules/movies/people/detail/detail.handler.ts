import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/http-errors";
import { MOVIES_REPOSITORY } from "../../movies.tokens";
import type { IMoviesRepository } from "../../movies.repository.interface";
import type { GetMoviePersonParams, GetMoviePersonQuery, MoviePersonPage } from "./detail.schema";

@injectable()
export class GetMoviePersonHandler {
  constructor(@inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetMoviePersonParams; Querystring: GetMoviePersonQuery }>): Promise<MoviePersonPage> {
    const page = request.query.page ?? 1;
    const limit = request.query.limit ?? 21;
    const result = await this.repo.findPublicPerson(request.params.wikidataId, { page, limit });
    if (!result) throw new NotFoundError("err_page_not_found");
    return {
      ...result,
      person: { ...result.person, name: result.person.name?.trim() || result.person.wikidataId },
      page, limit, totalPages: Math.ceil(result.total / limit),
    };
  }
}
