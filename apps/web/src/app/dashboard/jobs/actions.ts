"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { httpClient } from "../../../lib/httpClient";
import { jobsApi, type JobsApiResult } from "./jobsApi";
import type { JobSummary, RecurringJob } from "./types";

/**
 * `status` is the API's HTTP status, or 0 when the API could not be reached
 * (a transient failure the caller should retry).
 */
export type JobStreamResult = { url: string; expiresAt: string } | { error: string; status: number };

/**
 * Base URL the browser uses to reach the API. `API_URL` may be an internal
 * address; `NEXT_PUBLIC_API_URL` (already defined for the web app) overrides it.
 */
function publicApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  return base ? base.replace(/\/+$/, "") : null;
}

/**
 * Mints a short-lived, job-scoped stream token and returns the absolute SSE URL
 * the browser connects to directly. The session token never leaves the server.
 */
export async function createJobStreamAction(jobId: string): Promise<JobStreamResult> {
  const session = (await cookies()).get("session_token")?.value;
  if (!session) return { error: "Unauthorized.", status: 401 };

  const base = publicApiBase();
  if (!base) return { error: "API URL is not configured.", status: 500 };

  let res: Response;
  try {
    res = await httpClient.post(`/api/jobs/dashboard/${encodeURIComponent(jobId)}/stream-token`, undefined, {
      headers: { Authorization: `Bearer ${session}` },
    });
  } catch (error) {
    console.error("Job stream token error:", error);
    return { error: "Server connection error.", status: 0 };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.message || `Stream token request failed (${res.status}).`, status: res.status };
  }

  const data = (await res.json().catch(() => null)) as
    | { token?: string; expiresAt?: string; streamPath?: string }
    | null;
  if (!data?.token || !data.streamPath?.startsWith("/")) {
    return { error: "Invalid stream token response.", status: 502 };
  }

  return {
    url: `${base}${data.streamPath}?token=${encodeURIComponent(data.token)}`,
    expiresAt: data.expiresAt ?? "",
  };
}

/** `conflict` is set when the API answers 409 (an active job with the same concurrency key exists). */
export type JobActionResult<T> = { data: T } | { error: string; conflict?: boolean };

function done<T>(res: JobsApiResult<T>): JobActionResult<T> {
  if (!res.ok) return { error: res.error, conflict: res.status === 409 };
  revalidatePath("/dashboard/jobs");
  return { data: res.data };
}

export async function cancelJobAction(id: string) {
  return done(await jobsApi<JobSummary>("POST", `/api/jobs/dashboard/${encodeURIComponent(id)}/cancel`));
}

export async function retryJobAction(id: string) {
  return done(await jobsApi<JobSummary>("POST", `/api/jobs/dashboard/${encodeURIComponent(id)}/retry`));
}

export async function setRegisteredJobEnabledAction(id: string, enabled: boolean) {
  return done(
    await jobsApi<RecurringJob>("PUT", `/api/jobs/dashboard/recurring/${encodeURIComponent(id)}`, { enabled })
  );
}

export async function runRegisteredJobAction(id: string) {
  return done(await jobsApi<JobSummary>("POST", `/api/jobs/dashboard/recurring/${encodeURIComponent(id)}/run`));
}
