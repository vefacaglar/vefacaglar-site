import { sessions } from "@vefacaglar/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { ISessionsRepository } from "./sessions.repository.interface";

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

@injectable()
export class DrizzleSessionsRepository implements ISessionsRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async create(values: NewSession): Promise<Session> {
    const [row] = await this.dbProvider.client.insert(sessions).values(values).returning();
    return row;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<Session | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
          isNull(sessions.revokedAt)
        )
      )
      .limit(1);
    return row ?? null;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.dbProvider.client
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }
}
