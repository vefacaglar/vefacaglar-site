import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/http-errors";
import { TV_PREFERENCES_REPOSITORY, type ITvPreferencesRepository } from "../preferences.repository.interface";
import type { TvPreferenceParams, TvPreferences } from "../preferences.schema";
@injectable()
export class GetTvPreferencesHandler {
  constructor(@inject(TV_PREFERENCES_REPOSITORY) private readonly repo: ITvPreferencesRepository) {}
  async handle(request: FastifyRequest<{ Params: TvPreferenceParams }>): Promise<TvPreferences> {
    const preferences = await this.repo.find(request.user!.id, request.params.id);
    if (!preferences) throw new NotFoundError("err_tv_series_not_found");
    return preferences;
  }
}
