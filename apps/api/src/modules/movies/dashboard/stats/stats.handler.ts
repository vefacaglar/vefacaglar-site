import { inject, injectable } from "tsyringe";
import { MOVIE_DASHBOARD_REPOSITORY, type IMovieDashboardRepository } from "../movies-dashboard.repository.interface";
import type { MovieStats } from "./stats.schema";
@injectable()
export class GetMovieStatsHandler {
  constructor(@inject(MOVIE_DASHBOARD_REPOSITORY) private readonly repo: IMovieDashboardRepository) {}
  async handle(): Promise<MovieStats> {
    const stats = await this.repo.stats();
    return { movieCount: stats.publicFilmCount, catalogCount: stats.catalogCount, withPosterCount: stats.withPosterCount, posterBlockedCount: stats.posterBlockedCount };
  }
}
