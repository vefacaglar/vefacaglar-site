import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { EnqueueJobHandler } from "./enqueue.handler";
import type { IJobsRepository, Job } from "../../jobs.repository.interface";
import { BadRequestError, ConflictError } from "../../../../shared/http-errors";

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

const request = (body: unknown, userId = "user-1") =>
  ({ body, user: { id: userId } } as unknown as FastifyRequest<{ Body: any }>);

describe("EnqueueJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: EnqueueJobHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new EnqueueJobHandler(mockRepo as unknown as IJobsRepository);
  });

  it("enqueues search.reindex with the shared search.index key, linked to its registered job", async () => {
    mockRepo.findRecurringByType.mockResolvedValue({ id: "search.reindex", type: "search.reindex" });
    mockRepo.enqueue.mockResolvedValue(jobRow({ recurringJobId: "search.reindex" }));

    const result = await handler.handle(request({ type: "search.reindex", payload: {} }));

    expect(mockRepo.findRecurringByType).toHaveBeenCalledWith("search.reindex");
    expect(mockRepo.enqueue).toHaveBeenCalledWith({
      type: "search.reindex",
      payload: {},
      concurrencyKey: "search.index",
      recurringJobId: "search.reindex",
      createdBy: "user-1",
    });
    expect(result.status).toBe("queued");
    expect(result.recurringJobId).toBe("search.reindex");
  });

  it("enqueues search.sync with the same concurrency key as search.reindex", async () => {
    mockRepo.findRecurringByType.mockResolvedValue({ id: "search.sync", type: "search.sync" });
    mockRepo.enqueue.mockResolvedValue(jobRow({ type: "search.sync" }));

    await handler.handle(request({ type: "search.sync" }));

    expect(mockRepo.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: "search.sync", concurrencyKey: "search.index", recurringJobId: "search.sync" })
    );
  });

  it("does not link a run when the type has no registered job", async () => {
    mockRepo.findRecurringByType.mockResolvedValue(null);
    mockRepo.enqueue.mockResolvedValue(jobRow());

    await handler.handle(request({ type: "search.reindex" }));

    expect(mockRepo.enqueue).toHaveBeenCalledWith(expect.objectContaining({ recurringJobId: null }));
  });

  it("enqueues game popularity with the search indexing key and registered daily definition", async () => {
    const type = "catalog.popularity.refresh";
    mockRepo.findRecurringByType.mockResolvedValue({ id: type, type });
    mockRepo.enqueue.mockResolvedValue(jobRow({ type, recurringJobId: type }));
    await handler.handle(request({ type, payload: {} }));
    expect(mockRepo.enqueue).toHaveBeenCalledWith(expect.objectContaining({ type, payload: {}, concurrencyKey: "search.index", recurringJobId: type }));
  });

  it("rejects commands or provider overrides in a popularity job payload", async () => {
    await expect(handler.handle(request({ type: "catalog.popularity.refresh", payload: { command: "other" } }))).rejects.toThrow("err_job_invalid_payload");
    expect(mockRepo.enqueue).not.toHaveBeenCalled();
  });

  it("defaults a missing payload to an empty object", async () => {
    mockRepo.findRecurringByType.mockResolvedValue(null);
    mockRepo.enqueue.mockResolvedValue(jobRow());
    await handler.handle(request({ type: "search.reindex" }));

    expect(mockRepo.enqueue).toHaveBeenCalledWith(expect.objectContaining({ payload: {} }));
  });

  it("throws ConflictError when an active job holds the concurrency key", async () => {
    mockRepo.findRecurringByType.mockResolvedValue(null);
    mockRepo.enqueue.mockResolvedValue(null);

    await expect(handler.handle(request({ type: "search.reindex", payload: {} }))).rejects.toThrow(ConflictError);
    await expect(handler.handle(request({ type: "search.reindex", payload: {} }))).rejects.toThrow("err_job_already_active");
  });

  it("rejects an unknown job type without touching the repository", async () => {
    await expect(handler.handle(request({ type: "nope", payload: {} }))).rejects.toThrow(BadRequestError);
    await expect(handler.handle(request({ type: "nope", payload: {} }))).rejects.toThrow("err_job_unknown_type");
    await expect(handler.handle(request({ type: "constructor", payload: {} }))).rejects.toThrow("err_job_unknown_type");
    expect(mockRepo.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    [{ drop: true }],
    [{ drop: false }],
    [{ extra: 1 }],
  ])("rejects an invalid payload %j", async (payload) => {
    await expect(handler.handle(request({ type: "search.reindex", payload }))).rejects.toThrow("err_job_invalid_payload");
    expect(mockRepo.enqueue).not.toHaveBeenCalled();
  });
});
