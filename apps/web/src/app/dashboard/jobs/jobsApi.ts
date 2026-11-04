import { cookies } from "next/headers";
import { httpClient } from "../../../lib/httpClient";

/**
 * Server-side calls to the admin jobs API. The session token is an httpOnly
 * cookie and only ever leaves the server as a Bearer header to the API.
 */
export type JobsApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type Method = "GET" | "POST" | "PUT";

export async function jobsApi<T>(method: Method, path: string, body?: unknown): Promise<JobsApiResult<T>> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { ok: false, status: 401, error: "Unauthorized." };

  const init = { headers: { Authorization: `Bearer ${token}` } };

  try {
    const res =
      method === "GET"
        ? await httpClient.get(path, init)
        : method === "POST"
          ? await httpClient.post(path, body, init)
          : await httpClient.put(path, body, init);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, status: res.status, error: errData.message || `Request failed (${res.status}).` };
    }

    const text = await res.text();
    return { ok: true, data: (text ? JSON.parse(text) : undefined) as T };
  } catch (error) {
    console.error(`Jobs API error (${method} ${path}):`, error);
    return { ok: false, status: 502, error: "Server connection error." };
  }
}
