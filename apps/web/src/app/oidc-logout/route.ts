import { NextResponse, type NextRequest } from "next/server";
import { POST_LOGOUT_COOKIE, safeReturnPath } from "../../lib/logout";

export const dynamic = "force-dynamic";

/** Post-logout landing URL registered with the identity provider. */
export async function GET(request: NextRequest) {
  const target = safeReturnPath(request.cookies.get(POST_LOGOUT_COOKIE)?.value, "/dashboard/login");
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.delete(POST_LOGOUT_COOKIE);
  return response;
}
