import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";

function run(url: string, cookie?: string) {
  const request = new NextRequest(url, cookie ? { headers: { cookie } } : undefined);
  return middleware(request);
}

// NextResponse.next({ request: { headers } }) forwards overridden request headers to the
// app via these internal response headers.
const forwardedLocale = (res: Response) => res.headers.get("x-middleware-request-x-locale");
const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("middleware", () => {
  it.each(["/dashboard", "/dashboard/games", "/api/x", "/_next/static/chunk.js", "/favicon.ico", "/dashboard?lang=tr"])(
    "passes %s through untouched",
    (path) => {
      const res = run(`http://localhost${path}`);
      expect(isNext(res)).toBe(true);
      expect(forwardedLocale(res)).toBeNull();
    }
  );

  it("skips anything starting with a skipped prefix, even without a slash", () => {
    // NOTE: plain startsWith, so "/apiary" and "/dashboards" are skipped too (no x-locale header).
    expect(forwardedLocale(run("http://localhost/apiary"))).toBeNull();
    expect(forwardedLocale(run("http://localhost/dashboards"))).toBeNull();
  });

  it("permanently redirects legacy /tr URLs to ?lang=tr", () => {
    const home = run("http://localhost/tr");
    expect(home.status).toBe(308);
    expect(home.headers.get("location")).toBe("http://localhost/?lang=tr");

    const post = run("http://localhost/tr/blog/foo?page=2");
    expect(post.status).toBe(308);
    expect(post.headers.get("location")).toBe("http://localhost/blog/foo?page=2&lang=tr");
  });

  it("does not treat /tr-prefixed words as legacy URLs", () => {
    const res = run("http://localhost/travel");
    expect(res.status).toBe(200);
    expect(forwardedLocale(res)).toBe("en");
  });

  it("forwards the locale from ?lang as the x-locale request header", () => {
    expect(forwardedLocale(run("http://localhost/blog?lang=tr"))).toBe("tr");
    expect(forwardedLocale(run("http://localhost/blog?lang=en"))).toBe("en");
    expect(forwardedLocale(run("http://localhost/blog?lang=de"))).toBe("en");
    expect(forwardedLocale(run("http://localhost/blog"))).toBe("en");
  });

  it("ignores the lang cookie on pages other than home", () => {
    expect(forwardedLocale(run("http://localhost/blog", "lang=tr"))).toBe("en");
  });

  it("redirects the home page to ?lang=tr when the lang cookie says tr", () => {
    const res = run("http://localhost/", "lang=tr");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/?lang=tr");
  });

  it("keeps an explicit ?lang on the home page despite the cookie", () => {
    const res = run("http://localhost/?lang=en", "lang=tr");
    expect(res.status).toBe(200);
    expect(forwardedLocale(res)).toBe("en");
  });

  it("does not redirect home for an English cookie", () => {
    const res = run("http://localhost/", "lang=en");
    expect(res.status).toBe(200);
    expect(forwardedLocale(res)).toBe("en");
  });

  it("matches everything except static assets and images", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image|.*\\.png$|.*\\.ico$).*)"]);
  });
});
