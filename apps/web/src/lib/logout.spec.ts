import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), delete: vi.fn() },
  post: vi.fn(),
  getOidcDiscovery: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("./httpClient", () => ({ httpClient: { post: mocks.post } }));
vi.mock("./oidc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./oidc")>()),
  getOidcDiscovery: mocks.getOidcDiscovery,
}));

import { endSession, POST_LOGOUT_COOKIE, safeReturnPath } from "./logout";

function withCookies(values: Record<string, string>) {
  mocks.cookieStore.get.mockImplementation((name: string) => (name in values ? { value: values[name] } : undefined));
}

function stubOidc() {
  vi.stubEnv("AUTH_MODE", "oidc");
  vi.stubEnv("OIDC_ISSUER", "https://id.example.com");
  vi.stubEnv("OIDC_CLIENT_ID", "web");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vefacaglar.com");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("POST_LOGOUT_COOKIE", () => {
  it("keeps its cookie name", () => {
    expect(POST_LOGOUT_COOKIE).toBe("post_logout_to");
  });
});

describe("safeReturnPath", () => {
  it("returns same-origin paths", () => {
    expect(safeReturnPath("/", "/fallback")).toBe("/");
    expect(safeReturnPath("/games?lang=tr", "/fallback")).toBe("/games?lang=tr");
  });

  it("falls back for missing values", () => {
    expect(safeReturnPath(undefined, "/fallback")).toBe("/fallback");
    expect(safeReturnPath("", "/fallback")).toBe("/fallback");
  });

  it("falls back for relative, absolute and protocol-relative URLs", () => {
    expect(safeReturnPath("games", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("http://evil.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("https://evil.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("//evil.com", "/fallback")).toBe("/fallback");
  });

  it("accepts backslash and control-character tricks that safeInternalPath rejects", () => {
    // NOTE: weaker than safeInternalPath — browsers can treat "/\evil.com" and "/\t/evil.com" as
    // protocol-relative ("//evil.com"), so these are potential open redirects.
    expect(safeReturnPath("/\\evil.com", "/fallback")).toBe("/\\evil.com");
    expect(safeReturnPath("/\t/evil.com", "/fallback")).toBe("/\t/evil.com");
  });
});

describe("endSession", () => {
  it("logs out at the API with the session token and clears all auth cookies", async () => {
    withCookies({ session_token: "tok" });
    mocks.post.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(endSession()).resolves.toBeNull();

    expect(mocks.post).toHaveBeenCalledWith("/api/auth/logout", undefined, { headers: { Authorization: "Bearer tok" } });
    expect(mocks.cookieStore.delete.mock.calls.map((c) => c[0])).toEqual(["session_token", "oidc_id_token", "oidc_flow"]);
  });

  it("skips the API call without a session token but still clears cookies", async () => {
    withCookies({});

    await expect(endSession()).resolves.toBeNull();

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.cookieStore.delete).toHaveBeenCalledTimes(3);
  });

  it("ignores API logout failures", async () => {
    withCookies({ session_token: "tok" });
    mocks.post.mockRejectedValue(new Error("down"));

    await expect(endSession()).resolves.toBeNull();
    expect(mocks.cookieStore.delete).toHaveBeenCalledTimes(3);
  });

  it("returns null in password mode even with an id token", async () => {
    vi.stubEnv("AUTH_MODE", "password");
    withCookies({ session_token: "tok", oidc_id_token: "idt" });
    mocks.post.mockResolvedValue(new Response(null));

    await expect(endSession()).resolves.toBeNull();
    expect(mocks.getOidcDiscovery).not.toHaveBeenCalled();
  });

  it("returns null in oidc mode without an id token", async () => {
    stubOidc();
    withCookies({});

    await expect(endSession()).resolves.toBeNull();
    expect(mocks.getOidcDiscovery).not.toHaveBeenCalled();
  });

  it("returns the provider's logout URL in oidc mode with an id token", async () => {
    stubOidc();
    withCookies({ oidc_id_token: "idt" });
    mocks.getOidcDiscovery.mockResolvedValue({ end_session_endpoint: "https://id.example.com/logout?ui=1" });

    const url = new URL((await endSession())!);

    expect(url.origin + url.pathname).toBe("https://id.example.com/logout");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ui: "1",
      id_token_hint: "idt",
      client_id: "web",
      post_logout_redirect_uri: "https://vefacaglar.com/oidc-logout",
    });
  });

  it("returns null when the provider has no end-session endpoint", async () => {
    stubOidc();
    withCookies({ oidc_id_token: "idt" });
    mocks.getOidcDiscovery.mockResolvedValue({ authorization_endpoint: "a", token_endpoint: "t" });

    await expect(endSession()).resolves.toBeNull();
  });

  it("returns null when discovery fails", async () => {
    stubOidc();
    withCookies({ oidc_id_token: "idt" });
    mocks.getOidcDiscovery.mockRejectedValue(new Error("down"));

    await expect(endSession()).resolves.toBeNull();
  });
});
