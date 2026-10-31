import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SKIP_PREFIXES = ["/dashboard", "/api", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Legacy /tr/... URLs moved to ?lang=tr; redirect permanently so existing
  // links and search results keep working.
  if (pathname === "/tr" || pathname.startsWith("/tr/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    url.searchParams.set("lang", "tr");
    return NextResponse.redirect(url, 308);
  }

  const locale = searchParams.get("lang") === "tr" ? "tr" : "en";

  if (pathname === "/" && !searchParams.has("lang") && request.cookies.get("lang")?.value === "tr") {
    const url = request.nextUrl.clone();
    url.searchParams.set("lang", "tr");
    return NextResponse.redirect(url);
  }

  // Pass the locale to server components as a request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.ico$).*)"],
};
