import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "../../lib/httpClient";
import {
  getAuthMode,
  getOidcConfig,
  getOidcDiscovery,
  OidcFlowState,
  OIDC_FLOW_COOKIE,
  OIDC_ID_TOKEN_COOKIE,
} from "../../lib/oidc";

export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export async function GET(request: NextRequest) {
  if (getAuthMode() !== "oidc") {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  const { siteUrl, clientId, redirectUri } = getOidcConfig();
  const loginUrl = `${siteUrl}/dashboard/login`;

  const fail = (code: "failed" | "not_authorized", reason?: string) => {
    if (reason) console.error(`OIDC callback failed: ${reason}`);
    const target = new URL(loginUrl);
    target.searchParams.set("error", code);
    // Development only: surface the cause on the login page.
    if (reason && process.env.NODE_ENV !== "production") target.searchParams.set("reason", reason);
    const response = NextResponse.redirect(target);
    response.cookies.delete(OIDC_FLOW_COOKIE);
    return response;
  };

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  let flow: OidcFlowState | null = null;
  try {
    flow = JSON.parse(request.cookies.get(OIDC_FLOW_COOKIE)?.value ?? "null");
  } catch {
    flow = null;
  }

  if (params.get("error")) {
    return fail("failed", `provider returned ${params.get("error")} (${params.get("error_description") ?? "no description"})`);
  }
  if (!code || !state || !flow || flow.state !== state) {
    return fail("failed", `missing code/state or state cookie mismatch (cookie present: ${Boolean(flow)})`);
  }

  try {
    const { token_endpoint: tokenEndpoint } = await getOidcDiscovery();

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: flow.verifier,
      }),
      cache: "no-store",
    });
    if (!tokenRes.ok) {
      return fail("failed", `token endpoint ${tokenRes.status}: ${await tokenRes.text()}`);
    }

    const { id_token: idToken } = await tokenRes.json();
    if (!idToken) return fail("failed", "token response has no id_token");

    const exchangeRes = await httpClient.post("/api/auth/oidc/exchange", { idToken, nonce: flow.nonce });
    if (!exchangeRes.ok) {
      return fail("failed", `API exchange ${exchangeRes.status}: ${await exchangeRes.text()}`);
    }

    const { token, user } = await exchangeRes.json();

    // Only admins can use the dashboard. Drop the session of anyone else right away.
    if (user.role !== "admin") {
      await httpClient
        .post("/api/auth/logout", undefined, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => null);
      return fail("not_authorized");
    }

    const response = NextResponse.redirect(`${siteUrl}/dashboard`);
    const cookieOptions = {
      httpOnly: true,
      secure: siteUrl.startsWith("https://"),
      sameSite: "lax" as const,
      maxAge: SESSION_MAX_AGE,
      path: "/",
    };
    response.cookies.set("session_token", token, cookieOptions);
    response.cookies.set(OIDC_ID_TOKEN_COOKIE, idToken, cookieOptions);
    response.cookies.delete(OIDC_FLOW_COOKIE);
    return response;
  } catch (error) {
    return fail("failed", `unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
