import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { TV_SERIES_REPOSITORY, type ITvSeriesRepository } from "../tv-series.repository.interface";
import type { GetTvSeriesParams, TvSeriesDetail } from "./detail.schema";
@injectable()
export class GetTvSeriesHandler {
  constructor(@inject(TV_SERIES_REPOSITORY) private readonly repo: ITvSeriesRepository) {}
  async handle(request: FastifyRequest<{ Params: GetTvSeriesParams }>): Promise<TvSeriesDetail> {
    const series = await this.repo.findPublic(request.params.id);
    if (!series) throw new NotFoundError("err_tv_series_not_found");
    return series;
  }
}
