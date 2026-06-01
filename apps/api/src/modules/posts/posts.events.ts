import type { DomainEvent } from "../../shared/events/event-bus";

export const POST_ENTITY_CHANGED = "posts.entity.changed";
export const POST_ENTITY_REMOVED = "posts.entity.removed";

export interface PostEntityChangedEvent extends DomainEvent {
  readonly type: typeof POST_ENTITY_CHANGED;
  readonly id: string;
}

export interface PostEntityRemovedEvent extends DomainEvent {
  readonly type: typeof POST_ENTITY_REMOVED;
  readonly id: string;
}

export function postChanged(id: string): PostEntityChangedEvent {
  return { type: POST_ENTITY_CHANGED, id };
}

export function postRemoved(id: string): PostEntityRemovedEvent {
  return { type: POST_ENTITY_REMOVED, id };
}
