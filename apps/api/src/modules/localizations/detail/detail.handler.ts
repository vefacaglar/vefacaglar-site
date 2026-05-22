import { inject, injectable } from "tsyringe";
import { LOCALIZATIONS_REPOSITORY } from "../localizations.tokens";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import { GetLocalizationQuery, GetLocalizationResponse } from "./detail.schema";

@injectable()
export class GetLocalizationHandler {
  constructor(
    @inject(LOCALIZATIONS_REPOSITORY)
    private readonly localizationsRepo: ILocalizationsRepository
  ) {}

  async handle(query: GetLocalizationQuery): Promise<GetLocalizationResponse> {
    const row = await this.localizationsRepo.findOne(query);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      languageCode: row.languageCode,
      field: row.field,
      value: row.value,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
