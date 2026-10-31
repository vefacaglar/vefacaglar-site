import { createHash, randomBytes } from "crypto";

export type AuthMode = "oidc" | "password";

/** `password` (default) is the legacy login; `AUTH_MODE=oidc` opts in to the identity provider. */
export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE === "oidc" ? "oidc" : "password";
}

export const OIDC_FLOW_COOKIE = "oidc_flow";
export const OIDC_ID_TOKEN_COOKIE = "oidc_id_token";
export const OIDC_FLOW_MAX_AGE = 10 * 60;

export function getOidcConfig() {
  const issuer = process.env.OIDC_ISSUER?.replace(/\/+$/, "");
  const clientId = process.env.OIDC_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");

  if (!issuer || !clientId || !siteUrl) {
    throw new Error("OIDC_ISSUER, OIDC_CLIENT_ID and NEXT_PUBLIC_SITE_URL must be set.");
  }

  return {
    issuer,
    clientId,
    siteUrl,
    redirectUri: `${siteUrl}/callback`,
    postLogoutRedirectUri: `${siteUrl}/oidc-logout`,
  };
}

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

let discoveryCache: Promise<OidcDiscovery> | undefined;

export function getOidcDiscovery(): Promise<OidcDiscovery> {
  if (!discoveryCache) {
    const { issuer } = getOidcConfig();
    discoveryCache = fetch(`${issuer}/.well-known/openid-configuration`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`OIDC discovery failed with status ${res.status}.`);
        return res.json() as Promise<OidcDiscovery>;
      })
      .catch((error) => {
        discoveryCache = undefined;
        throw error;
      });
  }
  return discoveryCache;
}

const base64Url = (buffer: Buffer) => buffer.toString("base64url");

export function createPkceFlow() {
  const verifier = base64Url(randomBytes(32));
  return {
    verifier,
    challenge: base64Url(createHash("sha256").update(verifier).digest()),
    state: base64Url(randomBytes(16)),
    nonce: base64Url(randomBytes(16)),
  };
}

export interface OidcFlowState {
  state: string;
  nonce: string;
  verifier: string;
  /** Public page to return to after sign-in; absent for dashboard sign-ins. */
  returnTo?: string;
}

/**
 * Accepts only same-site public paths ("/games/foo?lang=tr"), never absolute
 * or protocol-relative URLs (open redirect) and never the dashboard, which is
 * admin-only and keeps its own post-login landing.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (value === "/dashboard" || value.startsWith("/dashboard/") || value.startsWith("/dashboard?")) return undefined;
  return value;
}
