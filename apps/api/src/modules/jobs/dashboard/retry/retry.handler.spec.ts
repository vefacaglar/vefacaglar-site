import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { RetryJobHandler } from "./retry.handler";
import type { IJobsRepository, Job } from "../../jobs.repository.interface";
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

const request = (id: string) => ({ params: { id } } as unknown as FastifyRequest<{ Params: any }>);

describe("RetryJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: RetryJobHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new RetryJobHandler(mockRepo as unknown as IJobsRepository);
  });

  it("throws NotFoundError for an unknown job", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(handler.handle(request("missing"))).rejects.toThrow(NotFoundError);
  });

  it.each(["failed", "cancelled"] as const)("requeues a %s job", async (status) => {
    mockRepo.findById.mockResolvedValue(jobRow({ status, attempts: 3, error: "boom" }));
    mockRepo.findActiveByConcurrencyKey.mockResolvedValue(null);
    mockRepo.requeue.mockResolvedValue(jobRow({ status: "queued", attempts: 0 }));

    const result = await handler.handle(request("id"));

    expect(mockRepo.findActiveByConcurrencyKey).toHaveBeenCalledWith("search.reindex");
    expect(mockRepo.requeue).toHaveBeenCalledWith("id");
    expect(result.status).toBe("queued");
    expect(result.attempts).toBe(0);
  });

  it.each(["queued", "running", "succeeded"] as const)("rejects retrying a %s job", async (status) => {
    mockRepo.findById.mockResolvedValue(jobRow({ status }));
    await expect(handler.handle(request("id"))).rejects.toThrow(BadRequestError);
    await expect(handler.handle(request("id"))).rejects.toThrow("err_job_invalid_state");
    expect(mockRepo.requeue).not.toHaveBeenCalled();
  });

  it("throws ConflictError when another job holds the concurrency key", async () => {
    mockRepo.findById.mockResolvedValue(jobRow({ status: "failed" }));
    mockRepo.findActiveByConcurrencyKey.mockResolvedValue(jobRow({ id: "other", status: "running" }));

    await expect(handler.handle(request("id"))).rejects.toThrow(ConflictError);
    expect(mockRepo.requeue).not.toHaveBeenCalled();
  });

  it("skips the concurrency check for jobs without a key", async () => {
    mockRepo.findById.mockResolvedValue(jobRow({ status: "failed", concurrencyKey: null }));
    mockRepo.requeue.mockResolvedValue(jobRow({ status: "queued", concurrencyKey: null }));

    await handler.handle(request("id"));
    expect(mockRepo.findActiveByConcurrencyKey).not.toHaveBeenCalled();
  });

  it("throws BadRequestError when the state changed before the update", async () => {
    mockRepo.findById.mockResolvedValue(jobRow({ status: "failed" }));
    mockRepo.findActiveByConcurrencyKey.mockResolvedValue(null);
    mockRepo.requeue.mockResolvedValue(null);

    await expect(handler.handle(request("id"))).rejects.toThrow(BadRequestError);
  });
});
