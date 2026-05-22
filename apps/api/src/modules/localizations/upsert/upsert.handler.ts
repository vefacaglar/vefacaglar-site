import { inject, injectable } from "tsyringe";
import { LOCALIZATIONS_REPOSITORY } from "../localizations.tokens";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import { UpsertLocalizationRequest, UpsertLocalizationResponse } from "./upsert.schema";

@injectable()
export class UpsertLocalizationHandler {
  constructor(
    @inject(LOCALIZATIONS_REPOSITORY)
    private readonly localizationsRepo: ILocalizationsRepository
  ) {}

  async handle(request: UpsertLocalizationRequest): Promise<UpsertLocalizationResponse> {
    const row = await this.localizationsRepo.upsert({
      entityType: request.entityType,
      entityId: request.entityId,
      languageCode: request.languageCode,
      field: request.field,
      value: request.value,
    });

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
