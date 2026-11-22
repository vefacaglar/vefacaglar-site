import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { BadRequestError, ConflictError, NotFoundError } from "../../../../shared/http-errors";
import { TV_PREFERENCES_REPOSITORY, type ITvPreferencesRepository } from "../preferences.repository.interface";
import type { TvPreferenceParams, TvPreferences, TvNoteBody } from "../preferences.schema";
@injectable()
export class SetTvNoteHandler {
  constructor(@inject(TV_PREFERENCES_REPOSITORY) private readonly repo: ITvPreferencesRepository) {}
  async handle(request: FastifyRequest<{ Params: TvPreferenceParams; Body: TvNoteBody }>): Promise<TvPreferences> {
    const { note, expectedVersion } = request.body;
    if (note !== null && (typeof note !== "string" || note.length > 2000)) throw new BadRequestError("err_tv_note_length");
    const result = await this.repo.setNote(request.user!.id, request.params.id, note?.trim() || null, expectedVersion);
    if (result.kind === "missing") throw new NotFoundError("err_tv_series_not_found");
    if (result.kind === "conflict") throw new ConflictError("err_tv_preferences_changed");
    return result.preferences;
  }
}
