import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: { get: vi.fn() },
  get: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unstable_rethrow: () => {} }));
vi.mock("./httpClient", () => ({ httpClient: { get: mocks.get } }));

import { getSessionUser, requireAdmin, SESSION_COOKIE_MAX_AGE } from "./session";

const admin = { id: "1", email: "a@b.c", username: "a", displayName: "A", role: "admin", isProfilePublic: false };

function withToken(token: string | undefined) {
  mocks.cookieStore.get.mockImplementation((name: string) => (name === "session_token" && token ? { value: token } : undefined));
}

function apiAnswers(status: number, body: unknown = {}) {
  mocks.get.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  });
});

describe("SESSION_COOKIE_MAX_AGE", () => {
  it("covers the API session's 30-day absolute lifetime", () => {
    expect(SESSION_COOKIE_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });
});

describe("getSessionUser", () => {
  it("returns null without calling the API when there is no session cookie", async () => {
    withToken(undefined);

    expect(await getSessionUser()).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("returns the user for a valid session", async () => {
    withToken("tok");
    apiAnswers(200, { user: admin });

    expect(await getSessionUser()).toEqual(admin);
    expect(mocks.get).toHaveBeenCalledWith("/api/auth/me", { headers: { Authorization: "Bearer tok" } });
  });

  it("returns null when the API is unavailable", async () => {
    withToken("tok");
    apiAnswers(503);

    expect(await getSessionUser()).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("redirects to login when there is no session cookie", async () => {
    withToken(undefined);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT /dashboard/login");
  });

  it("redirects to login when the API rejects the session", async () => {
    withToken("tok");
    apiAnswers(401);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT /dashboard/login");
  });

  it("throws instead of redirecting to login when the API answers 5xx", async () => {
    withToken("tok");
    apiAnswers(500);

    await expect(requireAdmin()).rejects.toThrow("The session could not be verified");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("throws instead of redirecting to login when the API cannot be reached", async () => {
    withToken("tok");
    mocks.get.mockRejectedValue(new TypeError("fetch failed"));

    await expect(requireAdmin()).rejects.toThrow("The session could not be verified");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sends non-admins home", async () => {
    withToken("tok");
    apiAnswers(200, { user: { ...admin, role: "user" } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT /");
  });

  it("returns an admin", async () => {
    withToken("tok");
    apiAnswers(200, { user: admin });

    expect(await requireAdmin()).toEqual(admin);
  });
});
