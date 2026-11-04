import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  unstable_rethrow: vi.fn(),
}));

// `cache` memoizes per request in React Server Components; outside of them it must be a pass-through.
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ unstable_rethrow: mocks.unstable_rethrow }));

import { getActiveLanguage } from "./lang";

function request({ headers = {}, cookies = {} }: { headers?: Record<string, string>; cookies?: Record<string, string> }) {
  mocks.headers.mockResolvedValue({ get: (name: string) => headers[name] ?? null });
  mocks.cookies.mockResolvedValue({ get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined) });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("getActiveLanguage", () => {
  it("uses the x-locale header set by the middleware first", async () => {
    request({ headers: { "x-locale": "tr", "accept-language": "en" }, cookies: { lang: "en" } });
    await expect(getActiveLanguage()).resolves.toBe("tr");

    request({ headers: { "x-locale": "en", "accept-language": "tr" }, cookies: { lang: "tr" } });
    await expect(getActiveLanguage()).resolves.toBe("en");
  });

  it("falls back to the lang cookie when x-locale is missing or unknown", async () => {
    request({ headers: { "x-locale": "de" }, cookies: { lang: "tr" } });
    await expect(getActiveLanguage()).resolves.toBe("tr");

    request({ headers: { "accept-language": "tr-TR" }, cookies: { lang: "en" } });
    await expect(getActiveLanguage()).resolves.toBe("en");
  });

  it("falls back to Accept-Language starting with 'tr' (any case)", async () => {
    request({ headers: { "accept-language": "tr-TR,tr;q=0.9,en;q=0.8" }, cookies: { lang: "fr" } });
    await expect(getActiveLanguage()).resolves.toBe("tr");

    request({ headers: { "accept-language": "TR" } });
    await expect(getActiveLanguage()).resolves.toBe("tr");
  });

  it("only looks at the first Accept-Language entry", async () => {
    request({ headers: { "accept-language": "en-US,tr;q=0.9" } });
    await expect(getActiveLanguage()).resolves.toBe("en");
  });

  it("defaults to English", async () => {
    request({});
    await expect(getActiveLanguage()).resolves.toBe("en");
  });

  it("hands errors to unstable_rethrow and defaults to English when it doesn't rethrow", async () => {
    const error = new Error("outside a request");
    mocks.headers.mockRejectedValue(error);

    await expect(getActiveLanguage()).resolves.toBe("en");
    expect(mocks.unstable_rethrow).toHaveBeenCalledWith(error);
  });

  it("propagates errors that unstable_rethrow rethrows (Next.js bailouts)", async () => {
    const bailout = new Error("DYNAMIC_SERVER_USAGE");
    mocks.headers.mockRejectedValue(bailout);
    mocks.unstable_rethrow.mockImplementation((e: unknown) => {
      throw e;
    });

    await expect(getActiveLanguage()).rejects.toBe(bailout);
  });
});
