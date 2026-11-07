import { inject, injectable } from "tsyringe";
import { MOVIE_ACTIVITY_REPOSITORY } from "../../activity/activity.tokens";
import type { IMovieActivityRepository } from "../../activity/activity.repository.interface";
import type { MovieStats } from "./stats.schema";
@injectable()
export class GetMovieStatsHandler {
  constructor(@inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(): Promise<MovieStats> { return { movieCount: await this.repo.countPublicMovies() }; }
}
