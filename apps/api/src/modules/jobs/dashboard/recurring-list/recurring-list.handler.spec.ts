import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListRecurringJobsHandler } from "./recurring-list.handler";
import type { IJobsRepository, Job, RecurringJob } from "../../jobs.repository.interface";

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

function recurringRow(overrides: Partial<RecurringJob> = {}): RecurringJob {
  return {
    id: "search.reindex",
    type: "search.reindex",
    cron: null,
    payload: {},
    enabled: true,
    nextRunAt: null,
    lastEnqueuedAt: new Date("2026-01-02T03:00:00.000Z"),
    lastJobId: "22222222-2222-4222-8222-222222222222",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function jobRow(overrides: Partial<Job> = {}): Job {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "search.reindex",
    status: "running",
    payload: {},
    progress: { phase: "games_en", processed: 10, total: 100 },
    checkpoint: null,
    concurrencyKey: "search.index",
    cancelRequested: false,
    attempts: 1,
    maxAttempts: 3,
    runAt: new Date("2026-01-02T03:00:00.000Z"),
    lockedBy: "worker-1",
    lockedAt: null,
    heartbeatAt: null,
    startedAt: new Date("2026-01-02T03:00:01.000Z"),
    finishedAt: null,
    error: null,
    recurringJobId: "search.reindex",
    createdBy: null,
    createdAt: new Date("2026-01-02T03:00:00.000Z"),
    updatedAt: new Date("2026-01-02T03:00:05.000Z"),
    ...overrides,
  };
}

describe("ListRecurringJobsHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: ListRecurringJobsHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new ListRecurringJobsHandler(mockRepo as unknown as IJobsRepository);
  });

  it("maps registered jobs with description, current and last run", async () => {
    const lastJob = jobRow({
      id: "33333333-3333-4333-8333-333333333333",
      status: "succeeded",
      lockedBy: null,
      finishedAt: new Date("2026-01-01T04:00:00.000Z"),
    });
    mockRepo.listRecurringOverview.mockResolvedValue([{ recurring: recurringRow(), currentJob: jobRow(), lastJob }]);

    const result = await handler.handle();

    expect(result.items).toHaveLength(1);
    const [item] = result.items;
    expect(item).toMatchObject({
      id: "search.reindex",
      type: "search.reindex",
      cron: null,
      payload: {},
      enabled: true,
      nextRunAt: null,
      lastEnqueuedAt: "2026-01-02T03:00:00.000Z",
      lastJobId: "22222222-2222-4222-8222-222222222222",
    });
    expect(item.description).toMatch(/reindex/i);
    expect(item.currentJob).toMatchObject({ id: "22222222-2222-4222-8222-222222222222", status: "running", progress: { processed: 10, total: 100 } });
    expect(item.lastJob).toMatchObject({ id: "33333333-3333-4333-8333-333333333333", status: "succeeded", finishedAt: "2026-01-01T04:00:00.000Z" });
  });

  it("returns null runs and a null description for an unknown type", async () => {
    mockRepo.listRecurringOverview.mockResolvedValue([
      { recurring: recurringRow({ id: "legacy", type: "legacy.type", cron: "0 3 * * *" }), currentJob: null, lastJob: null },
    ]);

    const [item] = (await handler.handle()).items;

    expect(item).toMatchObject({ id: "legacy", cron: "0 3 * * *", description: null, currentJob: null, lastJob: null });
  });

  it("describes search.sync", async () => {
    mockRepo.listRecurringOverview.mockResolvedValue([
      { recurring: recurringRow({ id: "search.sync", type: "search.sync" }), currentJob: null, lastJob: null },
    ]);

    const [item] = (await handler.handle()).items;
    expect(item.description).toMatch(/missing/i);
  });
});
