import { injectable } from "tsyringe";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import type { IOidcClient, OidcClaims } from "./oidc-client.interface";
import { HttpError, UnauthorizedError } from "../../../shared/http-errors";

interface DiscoveryDocument {
  issuer: string;
  jwks_uri: string;
}

@injectable()
export class OidcClient implements IOidcClient {
  private keys?: Promise<{ issuer: string; jwks: JWTVerifyGetKey }>;

  async verifyIdToken(idToken: string, nonce: string): Promise<OidcClaims> {
    const clientId = process.env.OIDC_CLIENT_ID;
    if (!clientId) {
      throw new HttpError(500, "OIDC server configuration error (OIDC_CLIENT_ID missing).");
    }

    const { issuer, jwks } = await this.loadKeys();

    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, jwks, { issuer, audience: clientId }));
    } catch (error) {
      console.error(`OIDC id_token verification failed: ${error instanceof Error ? error.message : error}`);
      throw new UnauthorizedError("Invalid identity token.");
    }

    if (payload.nonce !== nonce || typeof payload.sub !== "string") {
      console.error(`OIDC id_token rejected: nonce match=${payload.nonce === nonce}, sub present=${typeof payload.sub === "string"}`);
      throw new UnauthorizedError("Invalid identity token.");
    }

    return {
      issuer,
      subject: payload.sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: typeof payload.name === "string" ? payload.name : undefined,
      preferredUsername:
        typeof payload.preferred_username === "string" ? payload.preferred_username : undefined,
    };
  }

  private loadKeys() {
    if (!this.keys) {
      this.keys = this.discover().catch((error) => {
        this.keys = undefined;
        throw error;
      });
    }
    return this.keys;
  }

  private async discover() {
    const configured = process.env.OIDC_ISSUER?.replace(/\/+$/, "");
    if (!configured) {
      throw new HttpError(500, "OIDC server configuration error (OIDC_ISSUER missing).");
    }

    const response = await fetch(`${configured}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new HttpError(502, "Could not load the identity provider configuration.");
    }

    const doc = (await response.json()) as DiscoveryDocument;
    if (doc.issuer?.replace(/\/+$/, "") !== configured || !doc.jwks_uri) {
      throw new HttpError(502, "Identity provider configuration does not match OIDC_ISSUER.");
    }

    return { issuer: doc.issuer, jwks: createRemoteJWKSet(new URL(doc.jwks_uri)) };
  }
}
