import { inject, injectable } from "tsyringe";
import { LOCALIZATIONS_REPOSITORY } from "../localizations.tokens";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import { DeleteLocalizationQuery, DeleteLocalizationResponse } from "./delete.schema";
import { EVENT_BUS } from "../../../shared/events/events.tokens";
import type { IEventBus } from "../../../shared/events/event-bus";
import { postChanged } from "../../posts/posts.events";

@injectable()
export class DeleteLocalizationHandler {
  constructor(
    @inject(LOCALIZATIONS_REPOSITORY)
    private readonly localizationsRepo: ILocalizationsRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async handle(query: DeleteLocalizationQuery): Promise<DeleteLocalizationResponse> {
    const deletedCount = query.field
      ? await this.localizationsRepo.deleteOne({
          entityType: query.entityType,
          entityId: query.entityId,
          languageCode: query.languageCode,
          field: query.field,
        })
      : await this.localizationsRepo.deleteByEntity(
          query.entityType,
          query.entityId,
          query.languageCode
        );

    // Refresh Typesense post document when Turkish fields are removed.
    if (query.entityType === "post" && deletedCount > 0) {
      try {
        await this.eventBus.publish(postChanged(query.entityId));
      } catch {
        // best-effort; indexer will catch up via reindex
      }
    }

    return {
      success: true,
      deletedCount,
    };
  }
}
