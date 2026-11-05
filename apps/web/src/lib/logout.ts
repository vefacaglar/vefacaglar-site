import { cookies } from "next/headers";
import { httpClient } from "./httpClient";
import { getAuthMode, getOidcConfig, getOidcDiscovery, OIDC_FLOW_COOKIE, OIDC_ID_TOKEN_COOKIE } from "./oidc";
import { safeInternalPath } from "./safePath";
import { SITE_URL } from "./seo";

/** Where /oidc-logout sends the user after the identity provider has ended its session. */
export const POST_LOGOUT_COOKIE = "post_logout_to";

/** Only same-origin paths are accepted as post-logout targets. */
export function safeReturnPath(value: string | undefined, fallback: string): string {
  const path = safeInternalPath(value);
  return path && !path.includes("\\") ? path : fallback;
}

/** Standalone Next.js request URLs can contain its internal bind address. */
export function postLogoutRedirectUrl(value: string | undefined): URL {
  return new URL(safeReturnPath(value, "/dashboard/login"), SITE_URL);
}

/**
 * Ends the session in the API and clears the auth cookies. Returns the identity
 * provider's logout URL when its session has to be ended too, otherwise null.
 */
export async function endSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (token) {
    try {
      // Best effort API logout
      await httpClient.post("/api/auth/logout", undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.error("API logout failed:", e);
    }
  }

  const idToken = cookieStore.get(OIDC_ID_TOKEN_COOKIE)?.value;

  cookieStore.delete("session_token");
  cookieStore.delete(OIDC_ID_TOKEN_COOKIE);
  cookieStore.delete(OIDC_FLOW_COOKIE);

  return getProviderLogoutUrl(idToken);
}

/** RP-initiated logout URL at the identity provider, or null when there is nothing to end there. */
async function getProviderLogoutUrl(idToken: string | undefined): Promise<string | null> {
  if (getAuthMode() !== "oidc" || !idToken) return null;

  try {
    const { end_session_endpoint: endSessionEndpoint } = await getOidcDiscovery();
    if (!endSessionEndpoint) return null;

    const { clientId, postLogoutRedirectUri } = getOidcConfig();
    const url = new URL(endSessionEndpoint);
    url.searchParams.set("id_token_hint", idToken);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
    return url.toString();
  } catch (error) {
    console.error("OIDC logout error:", error);
    return null;
  }
}
