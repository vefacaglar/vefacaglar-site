export interface DomainEvent {
  readonly type: string;
}

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void | Promise<void>;

export interface IEventBus {
  /**
   * Dispatches an event to all subscribed handlers synchronously (awaits each
   * handler). A failing handler is isolated and logged so it never breaks the
   * command that published the event. Batch maintenance may opt into failure
   * propagation when search synchronization is required.
   */
  publish(event: DomainEvent, options?: { throwOnError?: boolean }): Promise<void>;
  subscribe<E extends DomainEvent>(type: string, handler: EventHandler<E>): void;
}
