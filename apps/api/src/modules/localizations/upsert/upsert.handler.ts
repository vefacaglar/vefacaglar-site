import { inject, injectable } from "tsyringe";
import { LOCALIZATIONS_REPOSITORY } from "../localizations.tokens";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import { UpsertLocalizationRequest, UpsertLocalizationResponse } from "./upsert.schema";
import { EVENT_BUS } from "../../../shared/events/events.tokens";
import type { IEventBus } from "../../../shared/events/event-bus";
import { postChanged } from "../../posts/posts.events";

@injectable()
export class UpsertLocalizationHandler {
  constructor(
    @inject(LOCALIZATIONS_REPOSITORY)
    private readonly localizationsRepo: ILocalizationsRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async handle(request: UpsertLocalizationRequest): Promise<UpsertLocalizationResponse> {
    const row = await this.localizationsRepo.upsert({
      entityType: request.entityType,
      entityId: request.entityId,
      languageCode: request.languageCode,
      field: request.field,
      value: request.value,
    });

    // Posts are the only Typesense-indexed localized entity; refresh its index
    // so a translation-only edit is reflected in search without a full reindex.
    if (request.entityType === "post") {
      try {
        await this.eventBus.publish(postChanged(request.entityId));
      } catch {
        // best-effort; indexer will catch up via reindex
      }
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
