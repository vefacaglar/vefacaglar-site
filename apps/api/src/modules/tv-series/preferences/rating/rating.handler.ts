import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { BadRequestError, ConflictError, NotFoundError } from "../../../../shared/http-errors";
import { TV_PREFERENCES_REPOSITORY, type ITvPreferencesRepository } from "../preferences.repository.interface";
import type { TvPreferenceParams, TvPreferences, TvRatingBody } from "../preferences.schema";
@injectable()
export class SetTvRatingHandler {
  constructor(@inject(TV_PREFERENCES_REPOSITORY) private readonly repo: ITvPreferencesRepository) {}
  async handle(request: FastifyRequest<{ Params: TvPreferenceParams; Body: TvRatingBody }>): Promise<TvPreferences> {
    const { rating, expectedVersion } = request.body;
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw new BadRequestError("err_tv_rating");
    const result = await this.repo.setRating(request.user!.id, request.params.id, rating, expectedVersion);
    if (result.kind === "missing") throw new NotFoundError("err_tv_series_not_found");
    if (result.kind === "conflict") throw new ConflictError("err_tv_preferences_changed");
    return result.preferences;
  }
}
