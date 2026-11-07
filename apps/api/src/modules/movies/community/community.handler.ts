import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { MOVIE_COMMUNITY_REPOSITORY } from "./community.tokens";
import type { IMovieCommunityRepository } from "./community.repository.interface";
import type { MovieCommunity, MovieCommunityParams, MovieCommunityQuery } from "./community.schema";

@injectable()
export class GetMovieCommunityHandler {
  constructor(@inject(MOVIE_COMMUNITY_REPOSITORY) private readonly repo: IMovieCommunityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieCommunityParams; Querystring: MovieCommunityQuery }>): Promise<MovieCommunity> {
    const id = await this.repo.findPublicMovieId(request.params.slug);
    if (!id) throw new NotFoundError("err_movie_not_found");
    const page = request.query.page ?? 1, limit = request.query.limit ?? 10;
    const result = await this.repo.getCommunity(id, page, limit);
    return {
      rating: { average: result.rating.average, count: result.rating.count, scale: 10 },
      entries: result.entries.map((entry) => ({
        id: entry.id,
        author: { username: entry.author.username, displayName: entry.author.displayName },
        sharedAt: entry.sharedAt.toISOString(),
        text: entry.text,
        rating: entry.rating,
        watchedOn: entry.watchedOn,
      })),
      total: result.total, page, limit, totalPages: Math.ceil(result.total / limit),
    };
  }
}
