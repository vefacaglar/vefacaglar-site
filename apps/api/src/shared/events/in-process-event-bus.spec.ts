import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { InProcessEventBus } from "./in-process-event-bus";

vi.mock("../application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));

describe("InProcessEventBus", () => {
  it("isolates a normal subscriber failure but propagates an explicitly required synchronization failure", async () => {
    const bus = new InProcessEventBus();
    bus.subscribe("test", async () => { throw new Error("search unavailable"); });
    await expect(bus.publish({ type: "test" })).resolves.toBeUndefined();
    await expect(bus.publish({ type: "test" }, { throwOnError: true })).rejects.toThrow("search unavailable");
  });
});
