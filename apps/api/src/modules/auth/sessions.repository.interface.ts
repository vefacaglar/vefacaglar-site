import type { Session, NewSession } from "./sessions.repository";

export interface ISessionsRepository {
  create(values: NewSession): Promise<Session>;
  findActiveByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(sessionId: string): Promise<void>;
}
