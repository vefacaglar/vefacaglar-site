import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest } from "fastify";
import { CreateStreamTokenHandler } from "./stream-token.handler";
import type { IJobsRepository, Job } from "../../jobs.repository.interface";
import type { IJobStreamTokenService } from "../../job-stream-token.service.interface";
import { NotFoundError, UnauthorizedError } from "../../../../shared/http-errors";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";

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

function createMockTokens(): Record<keyof IJobStreamTokenService, any> {
  return { sign: vi.fn(), verify: vi.fn(), authorize: vi.fn() };
}

const request = (id = JOB_ID, userId: string | null = USER_ID) =>
  ({ params: { id }, user: userId ? { id: userId, role: "admin" } : undefined } as unknown as FastifyRequest<{ Params: any }>);

describe("CreateStreamTokenHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let mockTokens: Record<keyof IJobStreamTokenService, any>;
  let handler: CreateStreamTokenHandler;

  beforeEach(() => {
    mockRepo = createMockRepo();
    mockTokens = createMockTokens();
    handler = new CreateStreamTokenHandler(
      mockRepo as unknown as IJobsRepository,
      mockTokens as unknown as IJobStreamTokenService
    );
  });

  it("issues a token bound to the job and the calling admin", async () => {
    mockRepo.findById.mockResolvedValue({ id: JOB_ID } as Job);
    mockTokens.sign.mockResolvedValue({ token: "jwt", expiresAt: new Date("2026-11-04T12:02:00.000Z") });

    const result = await handler.handle(request());

    expect(mockTokens.sign).toHaveBeenCalledWith(USER_ID, JOB_ID);
    expect(result).toEqual({
      token: "jwt",
      expiresAt: "2026-11-04T12:02:00.000Z",
      streamPath: `/api/jobs/dashboard/${JOB_ID}/stream`,
    });
  });

  it("throws NotFoundError for an unknown job without signing", async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(handler.handle(request())).rejects.toThrow(NotFoundError);
    await expect(handler.handle(request())).rejects.toThrow("err_job_not_found");
    expect(mockTokens.sign).not.toHaveBeenCalled();
  });

  it("refuses to sign without an authenticated user", async () => {
    await expect(handler.handle(request(JOB_ID, null))).rejects.toThrow(UnauthorizedError);
    expect(mockRepo.findById).not.toHaveBeenCalled();
    expect(mockTokens.sign).not.toHaveBeenCalled();
  });
});
