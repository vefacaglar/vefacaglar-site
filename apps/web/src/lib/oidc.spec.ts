import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPkceFlow,
  getAuthMode,
  getLoginHref,
  getOidcConfig,
  OIDC_FLOW_COOKIE,
  OIDC_FLOW_MAX_AGE,
  OIDC_ID_TOKEN_COOKIE,
  sanitizeReturnTo,
} from "./oidc";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubOidcEnv() {
  vi.stubEnv("OIDC_ISSUER", "https://id.example.com/realms/site/");
  vi.stubEnv("OIDC_CLIENT_ID", "web");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vefacaglar.com//");
}

describe("constants", () => {
  it("keeps the cookie names and flow lifetime", () => {
    expect(OIDC_FLOW_COOKIE).toBe("oidc_flow");
    expect(OIDC_ID_TOKEN_COOKIE).toBe("oidc_id_token");
    expect(OIDC_FLOW_MAX_AGE).toBe(600);
  });
});

describe("getAuthMode", () => {
  it("is 'oidc' only when AUTH_MODE is exactly 'oidc'", () => {
    vi.stubEnv("AUTH_MODE", "oidc");
    expect(getAuthMode()).toBe("oidc");
  });

  it("defaults to 'password'", () => {
    vi.stubEnv("AUTH_MODE", undefined);
    expect(getAuthMode()).toBe("password");
    vi.stubEnv("AUTH_MODE", "OIDC");
    expect(getAuthMode()).toBe("password");
    vi.stubEnv("AUTH_MODE", "password");
    expect(getAuthMode()).toBe("password");
  });
});

describe("getLoginHref", () => {
  it("goes through the OIDC route with an encoded returnTo in oidc mode", () => {
    vi.stubEnv("AUTH_MODE", "oidc");
    expect(getLoginHref("/explore/games/elden-ring?lang=tr")).toBe("/dashboard/login/oidc?returnTo=%2Fexplore%2Fgames%2Felden-ring%3Flang%3Dtr");
  });

  it("goes to the password login (ignoring returnTo) otherwise", () => {
    vi.stubEnv("AUTH_MODE", undefined);
    expect(getLoginHref("/explore/games/elden-ring")).toBe("/dashboard/login");
  });
});

describe("getOidcConfig", () => {
  it("trims trailing slashes and derives the redirect URIs", () => {
    stubOidcEnv();
    expect(getOidcConfig()).toEqual({
      issuer: "https://id.example.com/realms/site",
      clientId: "web",
      siteUrl: "https://vefacaglar.com",
      redirectUri: "https://vefacaglar.com/callback",
      postLogoutRedirectUri: "https://vefacaglar.com/oidc-logout",
    });
  });

  it.each(["OIDC_ISSUER", "OIDC_CLIENT_ID", "NEXT_PUBLIC_SITE_URL"])("throws when %s is missing", (name) => {
    stubOidcEnv();
    vi.stubEnv(name, "");
    expect(() => getOidcConfig()).toThrow("OIDC_ISSUER, OIDC_CLIENT_ID and NEXT_PUBLIC_SITE_URL must be set.");
  });
});

describe("getOidcDiscovery", () => {
  // Discovery is cached at module level, so each test loads a fresh copy.
  async function freshDiscovery() {
    vi.resetModules();
    return (await import("./oidc")).getOidcDiscovery;
  }

  it("fetches the issuer's discovery document once and caches it", async () => {
    stubOidcEnv();
    const doc = { authorization_endpoint: "https://id/auth", token_endpoint: "https://id/token" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(doc)));
    vi.stubGlobal("fetch", fetchMock);

    const getOidcDiscovery = await freshDiscovery();
    await expect(getOidcDiscovery()).resolves.toEqual(doc);
    await expect(getOidcDiscovery()).resolves.toEqual(doc);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://id.example.com/realms/site/.well-known/openid-configuration", {
      cache: "no-store",
    });
  });

  it("does not cache failures", async () => {
    stubOidcEnv();
    const doc = { authorization_endpoint: "a", token_endpoint: "t" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(doc)));
    vi.stubGlobal("fetch", fetchMock);

    const getOidcDiscovery = await freshDiscovery();
    await expect(getOidcDiscovery()).rejects.toThrow("OIDC discovery failed with status 503.");
    await expect(getOidcDiscovery()).resolves.toEqual(doc);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws synchronously when the config is missing", async () => {
    vi.stubEnv("OIDC_ISSUER", "");
    const getOidcDiscovery = await freshDiscovery();
    expect(() => getOidcDiscovery()).toThrow("must be set");
  });
});

describe("createPkceFlow", () => {
  it("returns base64url values with an S256 challenge of the verifier", () => {
    const flow = createPkceFlow();
    const base64Url = /^[A-Za-z0-9_-]+$/;

    expect(flow.verifier).toMatch(base64Url);
    expect(flow.verifier).toHaveLength(43);
    expect(flow.state).toHaveLength(22);
    expect(flow.nonce).toHaveLength(22);
    expect(flow.challenge).toBe(createHash("sha256").update(flow.verifier).digest("base64url"));
  });

  it("is random on every call", () => {
    const a = createPkceFlow();
    const b = createPkceFlow();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
  });
});

describe("sanitizeReturnTo", () => {
  it("accepts same-site public paths", () => {
    expect(sanitizeReturnTo("/explore/games/foo?lang=tr")).toBe("/explore/games/foo?lang=tr");
    expect(sanitizeReturnTo("/")).toBe("/");
    expect(sanitizeReturnTo("/dashboards")).toBe("/dashboards");
    expect(sanitizeReturnTo("/dashboard-old")).toBe("/dashboard-old");
  });

  it("rejects the dashboard", () => {
    expect(sanitizeReturnTo("/dashboard")).toBeUndefined();
    expect(sanitizeReturnTo("/dashboard/games")).toBeUndefined();
    expect(sanitizeReturnTo("/dashboard?tab=jobs")).toBeUndefined();
  });

  it("does not catch other spellings of the dashboard path", () => {
    // NOTE: only the exact "/dashboard" prefix is blocked; "/dashboard#x" or "/Dashboard" pass.
    expect(sanitizeReturnTo("/dashboard#x")).toBe("/dashboard#x");
    expect(sanitizeReturnTo("/Dashboard")).toBe("/Dashboard");
  });

  it("rejects anything safeInternalPath rejects", () => {
    expect(sanitizeReturnTo(undefined)).toBeUndefined();
    expect(sanitizeReturnTo(null)).toBeUndefined();
    expect(sanitizeReturnTo("")).toBeUndefined();
    expect(sanitizeReturnTo("https://evil.com")).toBeUndefined();
    expect(sanitizeReturnTo("//evil.com")).toBeUndefined();
    expect(sanitizeReturnTo("/\\evil.com")).toBeUndefined();
    expect(sanitizeReturnTo("/\t/evil.com")).toBeUndefined();
  });
});
