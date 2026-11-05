import { NextResponse, type NextRequest } from "next/server";
import { POST_LOGOUT_COOKIE, postLogoutRedirectUrl } from "../../lib/logout";

export const dynamic = "force-dynamic";

/** Post-logout landing URL registered with the identity provider. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(postLogoutRedirectUrl(request.cookies.get(POST_LOGOUT_COOKIE)?.value));
  response.cookies.delete(POST_LOGOUT_COOKIE);
  return response;
}
