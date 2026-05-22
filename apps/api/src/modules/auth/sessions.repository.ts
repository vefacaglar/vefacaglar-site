import { sessions } from "@vefacaglar/db";
import type { DbType } from "@vefacaglar/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable, inject } from "tsyringe";
import { DB_CONNECTION } from "../../db.tokens";
import type { ISessionsRepository } from "./sessions.repository.interface";

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

@injectable()
export class DrizzleSessionsRepository implements ISessionsRepository {
  constructor(@inject(DB_CONNECTION) private readonly db: DbType) {}

  async create(values: NewSession): Promise<Session> {
    const [row] = await this.db.insert(sessions).values(values).returning();
    return row;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<Session | null> {
    const [row] = await this.db
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
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }
}
