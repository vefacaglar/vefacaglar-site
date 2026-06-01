import { injectable } from "tsyringe";
import type { DomainEvent, EventHandler, IEventBus } from "./event-bus";

/**
 * Synchronous, in-process event bus. There is no message broker in this
 * project, so handlers run inline within the publishing request: `publish`
 * awaits every handler before resolving. Handler errors are caught and logged
 * so a failing subscriber (e.g. search indexing) never fails the command.
 */
@injectable()
export class InProcessEventBus implements IEventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe<E extends DomainEvent>(type: string, handler: EventHandler<E>): void {
    const existing = this.handlers.get(type);
    if (existing) {
      existing.push(handler as EventHandler);
    } else {
      this.handlers.set(type, [handler as EventHandler]);
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.length === 0) return;
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[events] handler for "${event.type}" failed:`, (err as Error).message);
      }
    }
  }
}
