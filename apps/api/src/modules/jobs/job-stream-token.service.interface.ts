import type { User } from "../auth/users.repository";

/** `scope` claim of a job stream token. */
export const JOB_STREAM_TOKEN_SCOPE = "job-stream";
export const JOB_STREAM_TOKEN_TTL_SECONDS = 120;

export interface JobStreamTokenConfig {
  /** HS256 key bytes. */
  secret: Uint8Array;
  ttlSeconds: number;
  /** True when `JOB_STREAM_TOKEN_SECRET` is unset and a random per-process key is used. */
  ephemeral: boolean;
}

/**
 * Short-lived, job-scoped JWTs that let the browser open the SSE stream
 * directly against the API (EventSource cannot send an Authorization header).
 * Claims: `sub` (user id), `jobId`, `scope: "job-stream"`, `iat`, `exp` (+120 s).
 */
export interface IJobStreamTokenService {
  sign(userId: string, jobId: string, now?: Date): Promise<{ token: string; expiresAt: Date }>;
  /** Signature, expiry, scope and job binding. Returns `null` for any invalid token. */
  verify(token: string, jobId: string, now?: Date): Promise<{ userId: string } | null>;
  /** `verify` + the user must still exist, be active and be an admin. */
  authorize(token: string, jobId: string): Promise<User | null>;
}
