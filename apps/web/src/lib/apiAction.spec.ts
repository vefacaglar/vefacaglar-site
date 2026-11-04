import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  revalidatePath: vi.fn(),
  revalidatePublicContent: vi.fn(),
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./cacheTags", () => ({ revalidatePublicContent: mocks.revalidatePublicContent }));
vi.mock("./httpClient", () => ({ httpClient: mocks.http }));

import { authedMutation, authedRequest } from "./apiAction";

const headers = { Authorization: "Bearer tok" };
const signedIn = () => mocks.cookieGet.mockImplementation((name: string) => (name === "session_token" ? { value: "tok" } : undefined));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("authedRequest", () => {
  it("returns Unauthorized without a session and never calls the API", async () => {
    await expect(authedRequest("POST", "/x")).resolves.toEqual({ error: "Unauthorized." });
    expect(mocks.http.post).not.toHaveBeenCalled();
  });

  it("calls the API with the Bearer header for each method", async () => {
    signedIn();
    for (const fn of Object.values(mocks.http)) fn.mockResolvedValue(new Response(""));

    await authedRequest("GET", "/g");
    await authedRequest("POST", "/p", { body: { a: 1 } });
    await authedRequest("PUT", "/u", { body: { b: 2 } });
    await authedRequest("DELETE", "/d");

    expect(mocks.http.get).toHaveBeenCalledWith("/g", { headers, cache: "no-store" });
    expect(mocks.http.post).toHaveBeenCalledWith("/p", { a: 1 }, { headers });
    expect(mocks.http.put).toHaveBeenCalledWith("/u", { b: 2 }, { headers });
    expect(mocks.http.delete).toHaveBeenCalledWith("/d", { headers });
  });

  it("returns parsed JSON, or undefined data for an empty body", async () => {
    signedIn();
    mocks.http.get.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 })));
    await expect(authedRequest("GET", "/g")).resolves.toEqual({ data: { id: 1 } });

    mocks.http.delete.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(authedRequest("DELETE", "/d")).resolves.toEqual({ data: undefined });
  });

  it("revalidates the given paths and public content after a mutation", async () => {
    signedIn();
    mocks.http.post.mockResolvedValue(new Response(""));

    await authedRequest("POST", "/p", { revalidate: ["/dashboard/games", "/games"] });

    expect(mocks.revalidatePath.mock.calls).toEqual([["/dashboard/games"], ["/games"]]);
    expect(mocks.revalidatePublicContent).toHaveBeenCalledTimes(1);
  });

  it("revalidates given paths but not public content after a GET", async () => {
    signedIn();
    mocks.http.get.mockResolvedValue(new Response(""));

    await authedRequest("GET", "/g", { revalidate: ["/dashboard"] });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePublicContent).not.toHaveBeenCalled();
  });

  it("returns the API error message, then the fallback, then a generic message", async () => {
    signedIn();
    mocks.http.put.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Slug taken." }), { status: 409 }));
    await expect(authedRequest("PUT", "/u", { fallbackError: "Could not save." })).resolves.toEqual({ error: "Slug taken." });

    mocks.http.put.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    await expect(authedRequest("PUT", "/u", { fallbackError: "Could not save." })).resolves.toEqual({ error: "Could not save." });

    mocks.http.put.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    await expect(authedRequest("PUT", "/u")).resolves.toEqual({ error: "Request failed." });
  });

  it("does not revalidate after a failed request", async () => {
    signedIn();
    mocks.http.post.mockResolvedValue(new Response("{}", { status: 400 }));

    await authedRequest("POST", "/p", { revalidate: ["/x"] });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidatePublicContent).not.toHaveBeenCalled();
  });

  it("maps thrown errors to a connection error", async () => {
    signedIn();
    mocks.http.get.mockRejectedValue(new TypeError("fetch failed"));
    await expect(authedRequest("GET", "/g")).resolves.toEqual({ error: "Server connection error." });
  });

  it("reports invalid JSON in a successful response as a connection error, after revalidating", async () => {
    signedIn();
    mocks.http.post.mockResolvedValue(new Response("{broken"));

    await expect(authedRequest("POST", "/p", { revalidate: ["/x"] })).resolves.toEqual({ error: "Server connection error." });
    // NOTE: revalidation already ran even though the action reports a failure.
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/x");
    expect(mocks.revalidatePublicContent).toHaveBeenCalled();
  });
});

describe("authedMutation", () => {
  it("collapses success to { success: true }", async () => {
    signedIn();
    mocks.http.post.mockResolvedValue(new Response(JSON.stringify({ id: 1 })));
    await expect(authedMutation("POST", "/p")).resolves.toEqual({ success: true });
  });

  it("collapses failure to { error }", async () => {
    await expect(authedMutation("DELETE", "/d")).resolves.toEqual({ error: "Unauthorized." });
  });
});
