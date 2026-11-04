import { jobsApi, type JobsApiResult } from "./jobsApi";
import { isActiveStatus, type JobFilter, type JobList } from "./types";

type ListFilter = {
  filter: JobFilter | null;
  page: number;
  limit: number;
  recurringJobId?: string | null;
};

const API_MAX_LIMIT = 100;

/**
 * Set once the API rejects (or ignores) `status=processing`; from then on this
 * server instance asks for queued and running separately and merges them.
 */
let processingUnsupported = false;

function listPath(status: string | null, page: number, limit: number, recurringJobId?: string | null) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set("status", status);
  if (recurringJobId) q.set("recurringJobId", recurringJobId);
  return `/api/jobs/dashboard?${q}`;
}

async function listProcessingFallback({ page, limit, recurringJobId }: ListFilter): Promise<JobsApiResult<JobList>> {
  // Enough rows from both lists to cut out the requested page after merging.
  const take = Math.min(API_MAX_LIMIT, page * limit);
  const [running, queued] = await Promise.all([
    jobsApi<JobList>("GET", listPath("running", 1, take, recurringJobId)),
    jobsApi<JobList>("GET", listPath("queued", 1, take, recurringJobId)),
  ]);
  if (!running.ok) return running;
  if (!queued.ok) return queued;

  const merged = [...running.data.items, ...queued.data.items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  return {
    ok: true,
    data: {
      items: merged.slice((page - 1) * limit, page * limit),
      total: running.data.total + queued.data.total,
      page,
      limit,
    },
  };
}

/** Lists runs; `processing` is sent as-is and falls back to queued + running on older APIs. */
export async function listJobs(f: ListFilter): Promise<JobsApiResult<JobList>> {
  if (f.filter !== "processing") {
    return jobsApi<JobList>("GET", listPath(f.filter, f.page, f.limit, f.recurringJobId));
  }
  if (!processingUnsupported) {
    const res = await jobsApi<JobList>("GET", listPath("processing", f.page, f.limit, f.recurringJobId));
    const honoured = res.ok && res.data.items.every((j) => isActiveStatus(j.status));
    if (honoured) return res;
    if (res.ok || res.status === 400) processingUnsupported = true;
    else return res;
  }
  return listProcessingFallback(f);
}

/** Number of runs matching a filter (cheap: limit=1). Null when the API call fails. */
export async function countJobs(filter: JobFilter, recurringJobId?: string | null): Promise<number | null> {
  const res = await listJobs({ filter, page: 1, limit: 1, recurringJobId });
  return res.ok ? res.data.total : null;
}
