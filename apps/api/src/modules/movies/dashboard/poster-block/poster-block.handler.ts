import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/http-errors";
import { MOVIE_DASHBOARD_REPOSITORY, type IMovieDashboardRepository } from "../movies-dashboard.repository.interface";
import type { MoviePosterBlock, MoviePosterBlockBody, MoviePosterBlockParams } from "./poster-block.schema";
@injectable()
export class SetMoviePosterBlockHandler {
  constructor(@inject(MOVIE_DASHBOARD_REPOSITORY) private readonly repo: IMovieDashboardRepository) {}
  async handle(request: FastifyRequest<{ Params: MoviePosterBlockParams; Body: MoviePosterBlockBody }>): Promise<MoviePosterBlock> {
    const row = await this.repo.setPosterBlocked(request.params.id, request.body.blocked, new Date());
    if (!row) throw new NotFoundError("err_movie_not_found");
    return { id: row.id, posterBlocked: row.posterBlockedAt !== null, posterBlockedAt: row.posterBlockedAt?.toISOString() ?? null };
  }
}
