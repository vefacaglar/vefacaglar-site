import { inject, injectable } from "tsyringe";
import { LOCALIZATIONS_REPOSITORY } from "../localizations.tokens";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import { SEARCH_INDEXER } from "../../../shared/search/search.tokens";
import type { ISearchIndexer } from "../../../shared/search/search-indexer.interface";
import { UpsertLocalizationRequest, UpsertLocalizationResponse } from "./upsert.schema";

@injectable()
export class UpsertLocalizationHandler {
  constructor(
    @inject(LOCALIZATIONS_REPOSITORY)
    private readonly localizationsRepo: ILocalizationsRepository,
    @inject(SEARCH_INDEXER) private readonly searchIndexer: ISearchIndexer
  ) {}

  async handle(request: UpsertLocalizationRequest): Promise<UpsertLocalizationResponse> {
    const row = await this.localizationsRepo.upsert({
      entityType: request.entityType,
      entityId: request.entityId,
      languageCode: request.languageCode,
      field: request.field,
      value: request.value,
    });

    await this.reindexIfGamesRelated(request.entityType, request.entityId);

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

  private async reindexIfGamesRelated(entityType: string, entityId: string): Promise<void> {
    switch (entityType) {
      case "game":
        await this.searchIndexer.indexGame(entityId);
        return;
      case "developer":
        await this.searchIndexer.indexDeveloper(entityId);
        return;
      case "publisher":
        await this.searchIndexer.indexPublisher(entityId);
        return;
      case "genre":
        await this.searchIndexer.indexGenre(entityId);
        return;
      case "platform":
        await this.searchIndexer.indexPlatform(entityId);
        return;
      case "theme":
        await this.searchIndexer.indexTheme(entityId);
        return;
      default:
        return;
    }
  }
}
