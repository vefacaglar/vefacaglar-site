export type AuthMode = "oidc" | "password";

/**
 * `password` (default) keeps the legacy email/password flow, so deploying without any
 * OIDC configuration changes nothing. Set `AUTH_MODE=oidc` to sign in through the
 * identity provider instead; switching back is the rollback.
 */
export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE === "oidc" ? "oidc" : "password";
}
