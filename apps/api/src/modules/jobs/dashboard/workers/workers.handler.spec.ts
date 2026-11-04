import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ListWorkersHandler } from "./workers.handler";
import type { IJobsRepository } from "../../jobs.repository.interface";

function createMockRepo(): Record<keyof IJobsRepository, any> {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    listLogs: vi.fn(),
    findJobWithLogsAfter: vi.fn(),
    findActiveByConcurrencyKey: vi.fn(),
    enqueue: vi.fn(),
    cancelQueued: vi.fn(),
    requestCancel: vi.fn(),
    requeue: vi.fn(),
    listRecurring: vi.fn(),
    listRecurringOverview: vi.fn(),
    findRecurringById: vi.fn(),
    findRecurringByType: vi.fn(),
    updateRecurring: vi.fn(),
    listWorkers: vi.fn(),
  };
}

describe("ListWorkersHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: ListWorkersHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    mockRepo = createMockRepo();
    handler = new ListWorkersHandler(mockRepo as unknown as IJobsRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks workers seen less than 30 seconds ago as online", async () => {
    const startedAt = new Date("2026-01-01T10:00:00.000Z");
    mockRepo.listWorkers.mockResolvedValue([
      { id: "w-1", hostname: "vps", version: "0.1.0", startedAt, lastSeenAt: new Date("2026-01-01T11:59:45.000Z") },
      { id: "w-2", hostname: "vps", version: "0.1.0", startedAt, lastSeenAt: new Date("2026-01-01T11:59:30.000Z") },
      { id: "w-3", hostname: "vps", version: "0.1.0", startedAt, lastSeenAt: new Date("2026-01-01T11:59:29.000Z") },
    ]);

    const result = await handler.handle();

    expect(result.items.map((w) => [w.id, w.online])).toEqual([
      ["w-1", true],
      ["w-2", false],
      ["w-3", false],
    ]);
    expect(result.items[0]).toEqual({
      id: "w-1",
      hostname: "vps",
      version: "0.1.0",
      startedAt: "2026-01-01T10:00:00.000Z",
      lastSeenAt: "2026-01-01T11:59:45.000Z",
      online: true,
    });
  });
});
