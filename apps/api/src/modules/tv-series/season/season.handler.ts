import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { TV_SERIES_REPOSITORY, type ITvSeriesRepository } from "../tv-series.repository.interface";
import type { GetTvSeasonParams, TvSeasonDetail } from "./season.schema";
@injectable()
export class GetTvSeasonHandler {
  constructor(@inject(TV_SERIES_REPOSITORY) private readonly repo: ITvSeriesRepository) {}
  async handle(request: FastifyRequest<{ Params: GetTvSeasonParams }>): Promise<TvSeasonDetail> {
    const season = await this.repo.findSeason(request.params.id, request.params.seasonId);
    if (!season) throw new NotFoundError("err_tv_season_not_found");
    return season;
  }
}
