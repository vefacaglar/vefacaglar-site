import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { GetJobHandler } from "./detail.handler";
import type { IJobsRepository, Job } from "../../jobs.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";

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

const request = (id: string, query: Record<string, unknown> = {}) =>
  ({ params: { id }, query } as unknown as FastifyRequest<{ Params: any; Querystring: any }>);

describe("GetJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: GetJobHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new GetJobHandler(mockRepo as unknown as IJobsRepository);
  });

  it("throws NotFoundError for an unknown job", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(handler.handle(request("missing"))).rejects.toThrow(NotFoundError);
    expect(mockRepo.listLogs).not.toHaveBeenCalled();
  });

  it("returns the job with logs after 0 by default, capped at 200", async () => {
    const job = jobRow();
    mockRepo.findById.mockResolvedValue(job);
    mockRepo.listLogs.mockResolvedValue([
      { id: 1, jobId: job.id, level: "info", message: "started", createdAt: new Date("2026-01-01T00:00:01.000Z") },
    ]);

    const result = await handler.handle(request(job.id));

    expect(mockRepo.listLogs).toHaveBeenCalledWith(job.id, 0, 200);
    expect(result.job.id).toBe(job.id);
    expect(result.logs).toEqual([{ id: 1, level: "info", message: "started", createdAt: "2026-01-01T00:00:01.000Z" }]);
  });

  it("passes afterLogId through", async () => {
    const job = jobRow();
    mockRepo.findById.mockResolvedValue(job);
    mockRepo.listLogs.mockResolvedValue([]);

    await handler.handle(request(job.id, { afterLogId: 42 }));
    expect(mockRepo.listLogs).toHaveBeenCalledWith(job.id, 42, 200);
  });
});
