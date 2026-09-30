export interface OidcClaims {
  issuer: string;
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  preferredUsername?: string;
}

export interface IOidcClient {
  /** Verifies signature, issuer, audience, expiry and nonce of an ID token. Throws on failure. */
  verifyIdToken(idToken: string, nonce: string): Promise<OidcClaims>;
}
