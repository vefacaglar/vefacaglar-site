import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { CancelJobHandler } from "./cancel.handler";
import type { IJobsRepository, Job } from "../../jobs.repository.interface";
import { BadRequestError, NotFoundError } from "../../../../shared/http-errors";

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

describe("CancelJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: CancelJobHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new CancelJobHandler(mockRepo as unknown as IJobsRepository);
  });

  it("throws NotFoundError for an unknown job", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(handler.handle(request("missing"))).rejects.toThrow(NotFoundError);
  });

  it("cancels a queued job immediately", async () => {
    mockRepo.findById.mockResolvedValue(jobRow({ status: "queued" }));
    mockRepo.cancelQueued.mockResolvedValue(
      jobRow({ status: "cancelled", finishedAt: new Date("2026-01-01T00:05:00.000Z") })
    );

    const result = await handler.handle(request("id"));

    expect(mockRepo.cancelQueued).toHaveBeenCalledWith("id");
    expect(mockRepo.requestCancel).not.toHaveBeenCalled();
    expect(result.status).toBe("cancelled");
    expect(result.finishedAt).toBe("2026-01-01T00:05:00.000Z");
  });

  it("requests cancellation of a running job", async () => {
    mockRepo.findById.mockResolvedValue(jobRow({ status: "running" }));
    mockRepo.requestCancel.mockResolvedValue(jobRow({ status: "running", cancelRequested: true }));

    const result = await handler.handle(request("id"));

    expect(mockRepo.cancelQueued).not.toHaveBeenCalled();
    expect(result.status).toBe("running");
    expect(result.cancelRequested).toBe(true);
  });

  it("falls back to a cancel request when a queued job was claimed meanwhile", async () => {
    mockRepo.findById.mockResolvedValue(jobRow({ status: "queued" }));
    mockRepo.cancelQueued.mockResolvedValue(null);
    mockRepo.requestCancel.mockResolvedValue(jobRow({ status: "running", cancelRequested: true }));

    const result = await handler.handle(request("id"));
    expect(result.cancelRequested).toBe(true);
  });

  it.each(["succeeded", "failed", "cancelled"] as const)("rejects cancelling a %s job", async (status) => {
    mockRepo.findById.mockResolvedValue(jobRow({ status }));
    await expect(handler.handle(request("id"))).rejects.toThrow(BadRequestError);
    expect(mockRepo.cancelQueued).not.toHaveBeenCalled();
    expect(mockRepo.requestCancel).not.toHaveBeenCalled();
  });
});
