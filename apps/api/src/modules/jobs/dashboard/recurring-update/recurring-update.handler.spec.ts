import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { UpdateRecurringJobHandler } from "./recurring-update.handler";
import type { IJobsRepository, RecurringJob } from "../../jobs.repository.interface";
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

function recurringRow(overrides: Partial<RecurringJob> = {}): RecurringJob {
  return {
    id: "search.reindex.daily",
    type: "search.reindex",
    cron: "0 3 * * *",
    payload: { drop: false },
    enabled: true,
    nextRunAt: new Date("2026-01-02T03:00:00.000Z"),
    lastEnqueuedAt: null,
    lastJobId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const request = (body: Record<string, unknown>, id = "search.reindex.daily") =>
  ({ params: { id }, body } as unknown as FastifyRequest<{ Params: any; Body: any }>);

describe("UpdateRecurringJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let handler: UpdateRecurringJobHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    handler = new UpdateRecurringJobHandler(mockRepo as unknown as IJobsRepository);
  });

  it("throws NotFoundError for an unknown recurring job", async () => {
    mockRepo.findRecurringById.mockResolvedValue(null);
    await expect(handler.handle(request({ enabled: false }, "missing"))).rejects.toThrow(NotFoundError);
    expect(mockRepo.updateRecurring).not.toHaveBeenCalled();
  });

  it("toggles enabled without touching the cron", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.updateRecurring.mockResolvedValue(recurringRow({ enabled: false }));

    const result = await handler.handle(request({ enabled: false }));

    expect(mockRepo.updateRecurring).toHaveBeenCalledWith("search.reindex.daily", { enabled: false, cron: undefined });
    expect(result.enabled).toBe(false);
  });

  it("passes a changed, normalized cron to the repository", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.updateRecurring.mockResolvedValue(recurringRow({ cron: "*/15 0-6 * * 1,3,5", nextRunAt: null }));

    const result = await handler.handle(request({ cron: "  */15   0-6 * * 1,3,5 " }));

    expect(mockRepo.updateRecurring).toHaveBeenCalledWith("search.reindex.daily", {
      enabled: undefined,
      cron: "*/15 0-6 * * 1,3,5",
    });
    expect(result.nextRunAt).toBeNull();
  });

  it("clears the cron with null (manual-only registered job)", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.updateRecurring.mockResolvedValue(recurringRow({ cron: null, nextRunAt: null }));

    const result = await handler.handle(request({ cron: null }));

    expect(mockRepo.updateRecurring).toHaveBeenCalledWith("search.reindex.daily", { enabled: undefined, cron: null });
    expect(result.cron).toBeNull();
    expect(result.nextRunAt).toBeNull();
  });

  it("does not touch the row's schedule when null is sent for an already manual-only job", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow({ cron: null, nextRunAt: null }));
    mockRepo.updateRecurring.mockResolvedValue(recurringRow({ cron: null, nextRunAt: null }));

    await handler.handle(request({ cron: null }));
    expect(mockRepo.updateRecurring).toHaveBeenCalledWith("search.reindex.daily", { enabled: undefined, cron: undefined });
  });

  it("sets a cron on a manual-only registered job", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow({ cron: null, nextRunAt: null }));
    mockRepo.updateRecurring.mockResolvedValue(recurringRow({ cron: "0 4 * * *", nextRunAt: null }));

    await handler.handle(request({ cron: "0 4 * * *" }));
    expect(mockRepo.updateRecurring).toHaveBeenCalledWith("search.reindex.daily", { enabled: undefined, cron: "0 4 * * *" });
  });

  it("does not reset the schedule when the cron is unchanged", async () => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.updateRecurring.mockResolvedValue(recurringRow());

    await handler.handle(request({ cron: "0 3 * * *" }));
    expect(mockRepo.updateRecurring).toHaveBeenCalledWith("search.reindex.daily", { enabled: undefined, cron: undefined });
  });

  it.each(["0 3 * * 0-7", "59 23 31 12 7", "0 0 1-15/2 */3 *", "5,10,15 * * * *"])("accepts %s", async (cron) => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    mockRepo.updateRecurring.mockResolvedValue(recurringRow({ cron }));
    await expect(handler.handle(request({ cron }))).resolves.toBeDefined();
  });

  it.each([
    "* * * *",
    "0 0 * * * *",
    "60 * * * *",
    "* 24 * * *",
    "* * 0 * *",
    "* * * 13 *",
    "* * * * 8",
    "5-1 * * * *",
    "*/0 * * * *",
    "@daily",
    "0 0 ? * MON",
    "0 0 L * *",
    "1,,2 * * * *",
  ])("rejects invalid cron %s", async (cron) => {
    mockRepo.findRecurringById.mockResolvedValue(recurringRow());
    await expect(handler.handle(request({ cron }))).rejects.toThrow(BadRequestError);
    await expect(handler.handle(request({ cron }))).rejects.toThrow("err_job_invalid_cron");
    expect(mockRepo.updateRecurring).not.toHaveBeenCalled();
  });
});
