import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SKIP_PREFIXES = ["/dashboard", "/api", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/tr")) {
    const pathWithoutLocale = pathname.replace(/^\/tr/, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = pathWithoutLocale;

    const response = NextResponse.rewrite(url);
    response.headers.set("x-locale", "tr");
    return response;
  }

  if (pathname === "/") {
    const langCookie = request.cookies.get("lang")?.value;
    if (langCookie === "tr") {
      return NextResponse.redirect(new URL("/tr", request.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-locale", "en");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.ico$).*)"],
};
