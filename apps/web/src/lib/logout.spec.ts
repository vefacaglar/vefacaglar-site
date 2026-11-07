import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), delete: vi.fn() },
  post: vi.fn(),
  getOidcDiscovery: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("./httpClient", () => ({ httpClient: { post: mocks.post } }));
vi.mock("./seo", () => ({ SITE_URL: "https://vefacaglar.com" }));
vi.mock("./oidc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./oidc")>()),
  getOidcDiscovery: mocks.getOidcDiscovery,
}));

import { endSession, POST_LOGOUT_COOKIE, postLogoutRedirectUrl, safeReturnPath } from "./logout";

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
    expect(safeReturnPath("/explore/games?lang=tr", "/fallback")).toBe("/explore/games?lang=tr");
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

  it.each(["/\\evil.com", "/a\\b", "/\t/evil.com", "/\n/evil.com", "/a\u0000", "/a\u007f"])("rejects backslash and control-character target %j", (target) => {
    expect(safeReturnPath(target, "/fallback")).toBe("/fallback");
  });
});

describe("postLogoutRedirectUrl", () => {
  it("returns to the canonical site without requiring OIDC configuration", () => {
    vi.stubEnv("AUTH_MODE", "password");
    vi.stubEnv("OIDC_ISSUER", "");
    vi.stubEnv("OIDC_CLIENT_ID", "");
    expect(postLogoutRedirectUrl(undefined).href).toBe("https://vefacaglar.com/dashboard/login");
  });

  it("preserves a legitimate return path, query and locale", () => {
    expect(postLogoutRedirectUrl("/explore/games?lang=tr#library").href).toBe("https://vefacaglar.com/explore/games?lang=tr#library");
    expect(postLogoutRedirectUrl("/").href).toBe("https://vefacaglar.com/");
  });

  it.each(["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "http://0.0.0.0:3000/dashboard/login"])("keeps invalid return target %j on the canonical origin", (target) => {
    const url = postLogoutRedirectUrl(target);
    expect(url.origin).toBe("https://vefacaglar.com");
    expect(url.pathname).toBe("/dashboard/login");
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
