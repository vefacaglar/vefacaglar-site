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
} from "../../../modules/catalog/catalog.events";
import {
  POST_ENTITY_CHANGED,
  POST_ENTITY_REMOVED,
  type PostEntityChangedEvent,
  type PostEntityRemovedEvent,
} from "../../../modules/posts/posts.events";

@injectable()
export class SearchEventSubscriber {
  private readonly gameIndexers: Record<GameEntityKind, (id: string) => Promise<void>>;
  private readonly gameRemovers: Record<GameEntityKind, (id: string) => Promise<void>>;

  constructor(
    @inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @inject(SEARCH_WRITER) private readonly indexer: ISearchIndexWriter
  ) {
    this.gameIndexers = {
      game: (id) => this.indexer.indexGame(id),
      developer: (id) => this.indexer.indexDeveloper(id),
      publisher: (id) => this.indexer.indexPublisher(id),
      genre: (id) => this.indexer.indexGenre(id),
      platform: (id) => this.indexer.indexPlatform(id),
      theme: (id) => this.indexer.indexTheme(id),
    };
    this.gameRemovers = {
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
      this.gameIndexers[event.kind](event.id)
    );
    this.eventBus.subscribe<GameEntityRemovedEvent>(GAME_ENTITY_REMOVED, (event) =>
      this.gameRemovers[event.kind](event.id)
    );

    this.eventBus.subscribe<PostEntityChangedEvent>(POST_ENTITY_CHANGED, (event) =>
      this.indexer.indexPost(event.id)
    );
    this.eventBus.subscribe<PostEntityRemovedEvent>(POST_ENTITY_REMOVED, (event) =>
      this.indexer.removePost(event.id)
    );
  }
}
