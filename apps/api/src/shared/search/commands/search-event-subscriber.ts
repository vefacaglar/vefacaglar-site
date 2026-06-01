import { inject, injectable } from "tsyringe";
import { EVENT_BUS } from "../../events/events.tokens";
import type { IEventBus } from "../../events/event-bus";
import { SEARCH_WRITER } from "../search.tokens";
import type { ISearchIndexWriter } from "./search-writer.interface";
import {
  GAME_ENTITY_CHANGED,
  GAME_ENTITY_REMOVED,
  type GameEntityChangedEvent,
  type GameEntityRemovedEvent,
  type GameEntityKind,
} from "../../../modules/games/games.events";

/**
 * Keeps the Typesense read model in sync with games-domain commands by reacting
 * to domain events. The write side (GameService) only publishes events; this
 * subscriber owns the index/remove mapping, so the command path has no
 * knowledge of search. Indexer calls are best-effort (they swallow their own
 * errors), and the event bus additionally isolates handler failures.
 */
@injectable()
export class SearchEventSubscriber {
  private readonly indexers: Record<GameEntityKind, (id: string) => Promise<void>>;
  private readonly removers: Record<GameEntityKind, (id: string) => Promise<void>>;

  constructor(
    @inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @inject(SEARCH_WRITER) private readonly indexer: ISearchIndexWriter
  ) {
    this.indexers = {
      game: (id) => this.indexer.indexGame(id),
      developer: (id) => this.indexer.indexDeveloper(id),
      publisher: (id) => this.indexer.indexPublisher(id),
      genre: (id) => this.indexer.indexGenre(id),
      platform: (id) => this.indexer.indexPlatform(id),
      theme: (id) => this.indexer.indexTheme(id),
    };
    this.removers = {
      game: (id) => this.indexer.removeGame(id),
      developer: (id) => this.indexer.removeDeveloper(id),
      publisher: (id) => this.indexer.removePublisher(id),
      genre: (id) => this.indexer.removeGenre(id),
      platform: (id) => this.indexer.removePlatform(id),
      theme: (id) => this.indexer.removeTheme(id),
    };
  }

  register(): void {
    this.eventBus.subscribe<GameEntityChangedEvent>(GAME_ENTITY_CHANGED, (event) =>
      this.indexers[event.kind](event.id)
    );
    this.eventBus.subscribe<GameEntityRemovedEvent>(GAME_ENTITY_REMOVED, (event) =>
      this.removers[event.kind](event.id)
    );
  }
}
