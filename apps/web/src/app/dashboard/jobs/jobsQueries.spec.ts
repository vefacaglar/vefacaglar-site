import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobsApiResult } from "./jobsApi";
import type { JobList, JobStatus, JobSummary } from "./types";

vi.mock("./jobsApi", () => ({ jobsApi: vi.fn() }));

type Module = typeof import("./jobsQueries");
type Api = typeof import("./jobsApi");

let listJobs: Module["listJobs"];
let countJobs: Module["countJobs"];
let jobsApi: ReturnType<typeof vi.mocked<Api["jobsApi"]>>;

function job(id: string, status: JobStatus, createdAt: string): JobSummary {
  return {
    id,
    type: "search.sync",
    status,
    payload: {},
    progress: {},
    cancelRequested: false,
    attempts: 0,
    maxAttempts: 3,
    runAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    recurringJobId: null,
    lockedBy: null,
    hasCheckpoint: false,
    createdAt,
    updatedAt: createdAt,
  };
}

const ok = (items: JobSummary[], total = items.length, page = 1, limit = 20): JobsApiResult<JobList> => ({
  ok: true,
  data: { items, total, page, limit },
});

const paths = () => jobsApi.mock.calls.map((call) => call[1]);

beforeEach(async () => {
  // The module remembers when the API doesn't support `processing`; start fresh each test.
  vi.resetModules();
  ({ listJobs, countJobs } = await import("./jobsQueries"));
  jobsApi = vi.mocked((await import("./jobsApi")).jobsApi);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("listJobs", () => {
  it("passes non-processing filters straight through", async () => {
    const res = ok([job("a", "failed", "2026-01-01T00:00:00Z")]);
    jobsApi.mockResolvedValue(res);

    await expect(listJobs({ filter: "failed", page: 2, limit: 10 })).resolves.toBe(res);
    expect(jobsApi).toHaveBeenCalledTimes(1);
    expect(jobsApi).toHaveBeenCalledWith("GET", "/api/jobs/dashboard?page=2&limit=10&status=failed");
  });

  it("omits the status for a null filter and adds recurringJobId when given", async () => {
    jobsApi.mockResolvedValue(ok([]));

    await listJobs({ filter: null, page: 1, limit: 20 });
    await listJobs({ filter: "succeeded", page: 1, limit: 20, recurringJobId: "search.reindex" });
    await listJobs({ filter: null, page: 1, limit: 20, recurringJobId: null });

    expect(paths()).toEqual([
      "/api/jobs/dashboard?page=1&limit=20",
      "/api/jobs/dashboard?page=1&limit=20&status=succeeded&recurringJobId=search.reindex",
      "/api/jobs/dashboard?page=1&limit=20",
    ]);
  });

  it("returns the API's processing list when it only contains active runs", async () => {
    const res = ok([job("a", "running", "2026-01-02T00:00:00Z"), job("b", "queued", "2026-01-01T00:00:00Z")]);
    jobsApi.mockResolvedValue(res);

    await expect(listJobs({ filter: "processing", page: 1, limit: 20 })).resolves.toBe(res);
    expect(paths()).toEqual(["/api/jobs/dashboard?page=1&limit=20&status=processing"]);
  });

  it("falls back to running + queued when the API ignores `processing`, and remembers it", async () => {
    jobsApi.mockImplementation(async (_method, path) => {
      if (path.includes("status=processing")) return ok([job("x", "succeeded", "2026-01-01T00:00:00Z")]);
      if (path.includes("status=running"))
        return ok([job("r1", "running", "2026-01-03T00:00:00Z"), job("r2", "running", "2026-01-01T00:00:00Z")], 2);
      return ok([job("q1", "queued", "2026-01-04T00:00:00Z"), job("q2", "queued", "2026-01-02T00:00:00Z")], 7);
    });

    const res = await listJobs({ filter: "processing", page: 1, limit: 3 });

    expect(res).toEqual({
      ok: true,
      data: {
        items: [
          job("q1", "queued", "2026-01-04T00:00:00Z"),
          job("r1", "running", "2026-01-03T00:00:00Z"),
          job("q2", "queued", "2026-01-02T00:00:00Z"),
        ],
        total: 9,
        page: 1,
        limit: 3,
      },
    });
    expect(paths()).toEqual([
      "/api/jobs/dashboard?page=1&limit=3&status=processing",
      "/api/jobs/dashboard?page=1&limit=3&status=running",
      "/api/jobs/dashboard?page=1&limit=3&status=queued",
    ]);

    jobsApi.mockClear();
    await listJobs({ filter: "processing", page: 1, limit: 3 });
    expect(paths()).toEqual(["/api/jobs/dashboard?page=1&limit=3&status=running", "/api/jobs/dashboard?page=1&limit=3&status=queued"]);
  });

  it("falls back when the API rejects `processing` with 400", async () => {
    jobsApi.mockImplementation(async (_method, path) =>
      path.includes("status=processing") ? { ok: false, status: 400, error: "Bad status." } : ok([])
    );

    await expect(listJobs({ filter: "processing", page: 1, limit: 5 })).resolves.toEqual({
      ok: true,
      data: { items: [], total: 0, page: 1, limit: 5 },
    });
    expect(jobsApi).toHaveBeenCalledTimes(3);
  });

  it("returns other errors as-is without falling back or remembering", async () => {
    const error = { ok: false as const, status: 500, error: "Boom." };
    jobsApi.mockResolvedValue(error);

    await expect(listJobs({ filter: "processing", page: 1, limit: 5 })).resolves.toBe(error);
    await expect(listJobs({ filter: "processing", page: 1, limit: 5 })).resolves.toBe(error);
    expect(paths()).toEqual([
      "/api/jobs/dashboard?page=1&limit=5&status=processing",
      "/api/jobs/dashboard?page=1&limit=5&status=processing",
    ]);
  });

  it("asks each list for page * limit rows (capped at 100) and slices the requested page", async () => {
    const running = Array.from({ length: 4 }, (_, i) => job(`r${i}`, "running", `2026-01-0${i + 1}T00:00:00Z`));
    jobsApi.mockImplementation(async (_method, path) => {
      if (path.includes("status=processing")) return { ok: false, status: 400, error: "" };
      if (path.includes("status=running")) return ok(running, 4);
      return ok([], 0);
    });

    const res = await listJobs({ filter: "processing", page: 2, limit: 2, recurringJobId: "search.sync" });
    expect(paths()).toContain("/api/jobs/dashboard?page=1&limit=4&status=running&recurringJobId=search.sync");
    expect(res.ok && res.data.items.map((j) => j.id)).toEqual(["r1", "r0"]);

    jobsApi.mockClear();
    await listJobs({ filter: "processing", page: 30, limit: 20 });
    expect(paths()).toEqual(["/api/jobs/dashboard?page=1&limit=100&status=running", "/api/jobs/dashboard?page=1&limit=100&status=queued"]);
  });

  it("returns the first failing list in the fallback (running before queued)", async () => {
    const runningError = { ok: false as const, status: 502, error: "running down" };
    const queuedError = { ok: false as const, status: 503, error: "queued down" };
    jobsApi.mockImplementation(async (_method, path) => {
      if (path.includes("status=processing")) return { ok: false, status: 400, error: "" };
      return path.includes("status=running") ? runningError : queuedError;
    });
    await expect(listJobs({ filter: "processing", page: 1, limit: 5 })).resolves.toBe(runningError);

    jobsApi.mockImplementation(async (_method, path) => (path.includes("status=running") ? ok([]) : queuedError));
    await expect(listJobs({ filter: "processing", page: 1, limit: 5 })).resolves.toBe(queuedError);
  });
});

describe("countJobs", () => {
  it("asks for a single row and returns the total", async () => {
    jobsApi.mockResolvedValue(ok([job("a", "failed", "2026-01-01T00:00:00Z")], 42));

    await expect(countJobs("failed", "search.reindex")).resolves.toBe(42);
    expect(paths()).toEqual(["/api/jobs/dashboard?page=1&limit=1&status=failed&recurringJobId=search.reindex"]);
  });

  it("is null when the API call fails", async () => {
    jobsApi.mockResolvedValue({ ok: false, status: 500, error: "Boom." });
    await expect(countJobs("cancelled")).resolves.toBeNull();
  });
});
