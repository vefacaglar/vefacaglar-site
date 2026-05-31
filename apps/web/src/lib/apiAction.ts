import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "./httpClient";

type Method = "GET" | "POST" | "PUT" | "DELETE";

type AuthedRequestOptions = {
  body?: unknown;
  /** Paths to revalidate after a successful mutation. */
  revalidate?: string[];
  /** Message returned when the API responds with a non-OK status and no body message. */
  fallbackError?: string;
};

/** Uniform shape returned by dashboard mutation actions. */
export type ActionResult = { success?: true; error?: string };

/**
 * Single entry point for authenticated dashboard → API calls from Server Actions.
 * Handles session-token lookup, bearer header, error parsing, revalidation and
 * connection-error fallback so individual actions stay one-liners.
 *
 * Returns `{ data }` on success (data is `undefined` for empty responses) or
 * `{ error }` on any failure.
 */
export async function authedRequest<T = any>(
  method: Method,
  path: string,
  opts: AuthedRequestOptions = {}
): Promise<{ data: T } | { error: string }> {
  const token = cookies().get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  const headers = { Authorization: `Bearer ${token}` };

  try {
    let res: Response;
    switch (method) {
      case "GET":
        res = await httpClient.get(path, { headers, cache: "no-store" });
        break;
      case "POST":
        res = await httpClient.post(path, opts.body, { headers });
        break;
      case "PUT":
        res = await httpClient.put(path, opts.body, { headers });
        break;
      case "DELETE":
        res = await httpClient.delete(path, { headers });
        break;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || opts.fallbackError || "Request failed." };
    }

    for (const p of opts.revalidate ?? []) revalidatePath(p);

    const text = await res.text();
    return { data: (text ? JSON.parse(text) : undefined) as T };
  } catch (error) {
    console.error(`API action error (${method} ${path}):`, error);
    return { error: "Server connection error." };
  }
}

/**
 * Convenience wrapper for mutations that only need a success/error result.
 * Collapses the `{ data } | { error }` shape into a uniform {@link ActionResult}.
 */
export async function authedMutation(
  method: Method,
  path: string,
  opts: AuthedRequestOptions = {}
): Promise<ActionResult> {
  const res = await authedRequest(method, path, opts);
  if ("error" in res) return { error: res.error };
  return { success: true };
}
