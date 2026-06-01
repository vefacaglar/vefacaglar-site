import type { DomainEvent } from "../../shared/events/event-bus";

export type GameEntityKind =
  | "game"
  | "developer"
  | "publisher"
  | "genre"
  | "platform"
  | "theme";

export const GAME_ENTITY_CHANGED = "games.entity.changed";
export const GAME_ENTITY_REMOVED = "games.entity.removed";

/** A games-domain entity was created or updated and its read model must be refreshed. */
export interface GameEntityChangedEvent extends DomainEvent {
  readonly type: typeof GAME_ENTITY_CHANGED;
  readonly kind: GameEntityKind;
  readonly id: string;
}

/** A games-domain entity was deleted and must be dropped from the read model. */
export interface GameEntityRemovedEvent extends DomainEvent {
  readonly type: typeof GAME_ENTITY_REMOVED;
  readonly kind: GameEntityKind;
  readonly id: string;
}

export function entityChanged(kind: GameEntityKind, id: string): GameEntityChangedEvent {
  return { type: GAME_ENTITY_CHANGED, kind, id };
}

export function entityRemoved(kind: GameEntityKind, id: string): GameEntityRemovedEvent {
  return { type: GAME_ENTITY_REMOVED, kind, id };
}
