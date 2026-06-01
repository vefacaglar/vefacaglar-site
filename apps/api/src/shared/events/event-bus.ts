export interface DomainEvent {
  readonly type: string;
}

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void | Promise<void>;

export interface IEventBus {
  /**
   * Dispatches an event to all subscribed handlers synchronously (awaits each
   * handler). A failing handler is isolated and logged so it never breaks the
   * command that published the event.
   */
  publish(event: DomainEvent): Promise<void>;
  subscribe<E extends DomainEvent>(type: string, handler: EventHandler<E>): void;
}
