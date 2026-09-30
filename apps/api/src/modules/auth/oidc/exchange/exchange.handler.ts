import { injectable, inject } from "tsyringe";
import { AuthService } from "../../auth.service";
import { OIDC_CLIENT, USERS_REPOSITORY } from "../../auth.tokens";
import type { IUsersRepository } from "../../users.repository.interface";
import type { User } from "../../users.repository";
import type { IOidcClient, OidcClaims } from "../oidc-client.interface";
import { UnauthorizedError } from "../../../../shared/http-errors";
import type { LoginResponse } from "../../login/login.schema";
import type { OidcExchangeRequest } from "./exchange.schema";

const DEFAULT_ROLE = "user";
const MAX_USERNAME_ATTEMPTS = 10;

@injectable()
export class OidcExchangeHandler {
  constructor(
    @inject(OIDC_CLIENT) private readonly oidcClient: IOidcClient,
    @inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository,
    private readonly authService: AuthService
  ) {}

  async handle(request: OidcExchangeRequest): Promise<LoginResponse> {
    const claims = await this.oidcClient.verifyIdToken(request.idToken, request.nonce);

    const user = await this.resolveUser(claims);
    if (!user.isActive) {
      throw new UnauthorizedError("This account is disabled.");
    }

    const result = await this.authService.createSession(user);
    await this.usersRepo.updateLastLogin(user.id);
    return result;
  }

  private async resolveUser(claims: OidcClaims): Promise<User> {
    const linked = await this.usersRepo.findByOidcSubject(claims.issuer, claims.subject);
    if (linked) return linked;

    if (!claims.email) {
      console.error("OIDC id_token has no email claim; the provider may only expose it via userinfo.");
      throw new UnauthorizedError("The identity provider did not return an email address.");
    }

    // An existing local account is linked only if the provider vouches for the email.
    const existing = await this.usersRepo.findByEmail(claims.email);
    if (existing) {
      if (!claims.emailVerified) {
        // Development only: reveals the subject so an existing account can be linked to it by hand.
        const hint = process.env.NODE_ENV === "production" ? "" : ` (sub: ${claims.subject}, issuer: ${claims.issuer})`;
        throw new UnauthorizedError(`The identity provider has not verified this email address.${hint}`);
      }
      if (existing.oidcSubject) {
        throw new UnauthorizedError("This account is already linked to another identity.");
      }
      return this.usersRepo.linkOidc(existing.id, claims.issuer, claims.subject);
    }

    // New users never get elevated rights; roles are managed in this database.
    return this.usersRepo.create({
      email: claims.email,
      username: await this.pickUsername(claims),
      displayName: claims.name ?? claims.email,
      passwordHash: null,
      role: DEFAULT_ROLE,
      oidcIssuer: claims.issuer,
      oidcSubject: claims.subject,
    });
  }

  private async pickUsername(claims: OidcClaims): Promise<string> {
    const raw = claims.preferredUsername ?? claims.email!.split("@")[0];
    const base = raw.toLowerCase().replace(/[^a-z0-9._-]/g, "") || "user";

    let candidate = base;
    for (let attempt = 2; attempt <= MAX_USERNAME_ATTEMPTS; attempt++) {
      if (!(await this.usersRepo.findByUsername(candidate))) return candidate;
      candidate = `${base}${attempt}`;
    }
    return `${base}-${claims.subject.slice(0, 8)}`;
  }
}
