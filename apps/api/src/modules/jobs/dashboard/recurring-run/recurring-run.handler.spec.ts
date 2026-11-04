import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { RunRecurringJobHandler } from "./recurring-run.handler";
import type { IJobsRepository, Job, RecurringJob } from "../../jobs.repository.interface";
import { BadRequestError, ConflictError, NotFoundError } from "../../../../shared/http-errors";

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

function jobRow(overrides: Partial<Job> = {}): Job {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "search.reindex",
    status: "queued",
    payload: {},
    progress: {},
    checkpoint: null,
    concurrencyKey: "search.reindex",
    cancelRequested: false,
    attempts: 0,
    maxAttempts: 3,
    runAt: new Date("2026-01-01T00:00:00.000Z"),
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    recurringJobId: null,
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function recurringRow(overrides: Partial<RecurringJob> = {}): RecurringJob {
  return {
    id: "search.sync",
    type: "search.sync",
    cron: null,
    payload: {},
    enabled: true,
    nextRunAt: null,
    lastEnqueuedAt: null,
    lastJobId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const request = (id = "search.sync") =>
  ({ params: { id }, user: { id: "user-1" } } as unknown as FastifyRequest<{ Params: any }>);

describe("RunRecurringJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: RunRecurringJobHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new RunRecurringJobHandler(mockRepo as unknown as IJobsRepository);
  });

  it("throws NotFoundError for an unknown recurring job", async () => {
    mockRepo.findRecurringById.mockResolvedValue(null);
    await expect(handler.handle(request("missing"))).rejects.toThrow(NotFoundError);
  });

  it("enqueues a manual-only (cron null) registered job linked to its id", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.enqueue.mockResolvedValue(jobRow({ type: "search.sync", recurringJobId: "search.sync" }));

    const result = await handler.handle(request());

    expect(mockRepo.enqueue).toHaveBeenCalledWith({
      type: "search.sync",
      payload: {},
      concurrencyKey: "search.index",
      recurringJobId: "search.sync",
      createdBy: "user-1",
    });
    expect(result.recurringJobId).toBe("search.sync");
  });

  it("throws ConflictError when a job with the same concurrency key is active", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.enqueue.mockResolvedValue(null);
    await expect(handler.handle(request())).rejects.toThrow(ConflictError);
  });

  it("rejects a definition whose type is not allowlisted", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow({ type: "legacy.type" }));
    await expect(handler.handle(request())).rejects.toThrow(BadRequestError);
    expect(mockRepo.enqueue).not.toHaveBeenCalled();
  });
});
