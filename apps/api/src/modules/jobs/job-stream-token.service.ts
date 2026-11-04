import { reportRuntimeFailure } from "../../shared/application-logs/runtime-failures";
import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { inject, injectable } from "tsyringe";
import { USERS_REPOSITORY } from "../auth/auth.tokens";
import type { IUsersRepository } from "../auth/users.repository.interface";
import type { User } from "../auth/users.repository";
import { JOB_STREAM_TOKEN_CONFIG } from "./jobs.tokens";
import {
  JOB_STREAM_TOKEN_SCOPE,
  JOB_STREAM_TOKEN_TTL_SECONDS,
  type IJobStreamTokenService,
  type JobStreamTokenConfig,
} from "./job-stream-token.service.interface";

const ALGORITHM = "HS256";

/**
 * Reads `JOB_STREAM_TOKEN_SECRET`. When it is unset, a random per-process key
 * is used: fine for a single API instance (tokens live 120 s and clients simply
 * request a new one after a restart), but every instance needs the same secret
 * once the API runs on more than one.
 */
export function readJobStreamTokenConfig(env: NodeJS.ProcessEnv = process.env): JobStreamTokenConfig {
  const configured = env.JOB_STREAM_TOKEN_SECRET?.trim();
  if (configured) {
    return { secret: new TextEncoder().encode(configured), ttlSeconds: JOB_STREAM_TOKEN_TTL_SECONDS, ephemeral: false };
  }
  return { secret: randomBytes(32), ttlSeconds: JOB_STREAM_TOKEN_TTL_SECONDS, ephemeral: true };
}

@injectable()
export class JobStreamTokenService implements IJobStreamTokenService {
  private warned = false;

  constructor(
    @inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository,
    @inject(JOB_STREAM_TOKEN_CONFIG) private readonly config: JobStreamTokenConfig
  ) {}

  async sign(userId: string, jobId: string, now: Date = new Date()): Promise<{ token: string; expiresAt: Date }> {
    if (this.config.ephemeral && !this.warned) {
      this.warned = true;
      reportRuntimeFailure(
        "job_stream_secret_missing",
        "JOB_STREAM_TOKEN_SECRET is missing. Using a temporary key for stream tokens",
        undefined,
        "warning",
      );
    }
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + this.config.ttlSeconds;
    const token = await new SignJWT({ jobId, scope: JOB_STREAM_TOKEN_SCOPE })
      .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
      .setSubject(userId)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.config.secret);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  async verify(token: string, jobId: string, now: Date = new Date()): Promise<{ userId: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.config.secret, {
        algorithms: [ALGORITHM],
        currentDate: now,
        requiredClaims: ["sub", "iat", "exp"],
      });
      if (payload.scope !== JOB_STREAM_TOKEN_SCOPE) return null;
      if (typeof payload.jobId !== "string" || payload.jobId !== jobId) return null;
      if (typeof payload.sub !== "string" || payload.sub === "") return null;
      return { userId: payload.sub };
    } catch {
      // Malformed, bad signature, expired, ...
      return null;
    }
  }

  async authorize(token: string, jobId: string): Promise<User | null> {
    const claims = await this.verify(token, jobId);
    if (!claims) return null;
    const user = await this.usersRepo.findById(claims.userId);
    if (!user || !user.isActive || user.role !== "admin") return null;
    return user;
  }
}
