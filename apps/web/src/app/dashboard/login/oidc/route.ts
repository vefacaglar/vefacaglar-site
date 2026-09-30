import { NextResponse } from "next/server";
import { createPkceFlow, getAuthMode, getOidcConfig, getOidcDiscovery, OIDC_FLOW_COOKIE, OIDC_FLOW_MAX_AGE } from "../../../../lib/oidc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (getAuthMode() !== "oidc") {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  const { siteUrl, clientId, redirectUri } = getOidcConfig();

  let authorizationEndpoint: string;
  try {
    ({ authorization_endpoint: authorizationEndpoint } = await getOidcDiscovery());
  } catch (error) {
    console.error("OIDC discovery error:", error);
    return NextResponse.redirect(`${siteUrl}/dashboard/login?error=failed`);
  }

  const { verifier, challenge, state, nonce } = createPkceFlow();

  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url);
  response.cookies.set(OIDC_FLOW_COOKIE, JSON.stringify({ state, nonce, verifier }), {
    httpOnly: true,
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: OIDC_FLOW_MAX_AGE,
    path: "/",
  });
  return response;
}
