import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("../../../lib/httpClient", () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { httpClient } from "../../../lib/httpClient";
import { jobsApi } from "./jobsApi";

const http = vi.mocked(httpClient);

const signedIn = () => cookieStore.get.mockImplementation((name: string) => (name === "session_token" ? { value: "tok" } : undefined));
const auth = { headers: { Authorization: "Bearer tok" } };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  cookieStore.get.mockReset();
});

describe("jobsApi", () => {
  it("returns 401 without calling the API when there is no session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(jobsApi("GET", "/api/jobs/dashboard")).resolves.toEqual({ ok: false, status: 401, error: "Unauthorized." });
    expect(http.get).not.toHaveBeenCalled();
  });

  it("sends the session as a Bearer header with the right method", async () => {
    signedIn();
    http.get.mockResolvedValue(new Response("{}"));
    http.post.mockResolvedValue(new Response("{}"));
    http.put.mockResolvedValue(new Response("{}"));

    await jobsApi("GET", "/a");
    await jobsApi("POST", "/b", { x: 1 });
    await jobsApi("PUT", "/c", { y: 2 });

    expect(http.get).toHaveBeenCalledWith("/a", auth);
    expect(http.post).toHaveBeenCalledWith("/b", { x: 1 }, auth);
    expect(http.put).toHaveBeenCalledWith("/c", { y: 2 }, auth);
  });

  it("parses JSON bodies and returns undefined data for empty bodies", async () => {
    signedIn();
    http.get.mockResolvedValueOnce(new Response(JSON.stringify({ total: 3 })));
    await expect(jobsApi("GET", "/a")).resolves.toEqual({ ok: true, data: { total: 3 } });

    http.post.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(jobsApi("POST", "/b")).resolves.toEqual({ ok: true, data: undefined });
  });

  it("maps non-OK responses to the API message or a status fallback", async () => {
    signedIn();
    http.get.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Job not found." }), { status: 404 }));
    await expect(jobsApi("GET", "/a")).resolves.toEqual({ ok: false, status: 404, error: "Job not found." });

    http.get.mockResolvedValueOnce(new Response("not json", { status: 500 }));
    await expect(jobsApi("GET", "/a")).resolves.toEqual({ ok: false, status: 500, error: "Request failed (500)." });
  });

  it("maps thrown errors (network, invalid JSON) to 502", async () => {
    signedIn();
    http.get.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(jobsApi("GET", "/a")).resolves.toEqual({ ok: false, status: 502, error: "Server connection error." });

    http.get.mockResolvedValueOnce(new Response("{broken"));
    await expect(jobsApi("GET", "/a")).resolves.toEqual({ ok: false, status: 502, error: "Server connection error." });
  });
});
