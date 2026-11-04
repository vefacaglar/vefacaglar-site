import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { ListJobsHandler } from "./list.handler";
import type { IJobsRepository, Job } from "../../jobs.repository.interface";

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

describe("ListJobsHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: ListJobsHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new ListJobsHandler(mockRepo as unknown as IJobsRepository);
  });

  it("defaults to page 1 and limit 20", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });
    const result = await handler.handle({ query: {} } as unknown as FastifyRequest<{ Querystring: any }>);

    expect(mockRepo.list).toHaveBeenCalledWith({ status: undefined, type: undefined, recurringJobId: undefined, page: 1, limit: 20 });
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it("passes status, type and pagination filters through", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });
    await handler.handle({
      query: { status: "failed", type: "search.reindex", recurringJobId: undefined, page: 2, limit: 10 },
    } as unknown as FastifyRequest<{ Querystring: any }>);

    expect(mockRepo.list).toHaveBeenCalledWith({ status: "failed", type: "search.reindex", recurringJobId: undefined, page: 2, limit: 10 });
  });

  it("passes the processing group and the registered job filter through", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0 });
    await handler.handle({
      query: { status: "processing", recurringJobId: "search.sync" },
    } as unknown as FastifyRequest<{ Querystring: any }>);

    expect(mockRepo.list).toHaveBeenCalledWith({ status: "processing", type: undefined, recurringJobId: "search.sync", page: 1, limit: 20 });
  });

  it("maps rows to JobSummary with ISO timestamps and no internal fields", async () => {
    mockRepo.list.mockResolvedValue({
      items: [
        jobRow({
          status: "running",
          progress: { phase: "games_en", processed: 500, total: 2000 },
          startedAt: new Date("2026-01-01T00:01:00.000Z"),
          lockedBy: "worker-1",
          checkpoint: { collectionIndex: 0, lastId: "x" },
        }),
      ],
      total: 1,
    });

    const result = await handler.handle({ query: {} } as unknown as FastifyRequest<{ Querystring: any }>);
    const item = result.items[0];

    expect(item).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "running",
      progress: { phase: "games_en", processed: 500, total: 2000 },
      runAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:01:00.000Z",
      finishedAt: null,
      cancelRequested: false,
      lockedBy: "worker-1",
      hasCheckpoint: true,
      recurringJobId: null,
    });
    expect(item).not.toHaveProperty("checkpoint");
    expect(item).not.toHaveProperty("lockedAt");
    expect(result.total).toBe(1);
  });

  it("reports hasCheckpoint=false and lockedBy=null for a fresh job", async () => {
    mockRepo.list.mockResolvedValue({ items: [jobRow()], total: 1 });
    const result = await handler.handle({ query: {} } as unknown as FastifyRequest<{ Querystring: any }>);

    expect(result.items[0].hasCheckpoint).toBe(false);
    expect(result.items[0].lockedBy).toBeNull();
  });
});
