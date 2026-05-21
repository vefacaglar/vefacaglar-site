import { db, sessions, users } from "@vefacaglar/db";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return row ?? null;
  }

  async updateLastLogin(id: string): Promise<void> {
    const now = new Date();
    await db.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, id));
  }

  /**
   * Updates profile fields with in-transaction uniqueness checks against other users.
   * Throws "EmailAlreadyExists" or "UsernameAlreadyExists" on conflict.
   */
  async updateProfile(
    userId: string,
    patch: { email: string; username: string; displayName: string }
  ): Promise<User> {
    return await db.transaction(async (tx) => {
      const emailExists = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, patch.email), ne(users.id, userId)))
        .limit(1);
      if (emailExists.length > 0) {
        throw new Error("EmailAlreadyExists");
      }

      const usernameExists = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, patch.username), ne(users.id, userId)))
        .limit(1);
      if (usernameExists.length > 0) {
        throw new Error("UsernameAlreadyExists");
      }

      const [row] = await tx
        .update(users)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return row;
    });
  }

  /**
   * Atomically updates the password hash and revokes all other active sessions for the user.
   */
  async changePasswordAndRevokeOtherSessions(
    userId: string,
    currentSessionId: string,
    newPasswordHash: string
  ): Promise<void> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: now })
        .where(eq(users.id, userId));

      await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(sessions.userId, userId),
            ne(sessions.id, currentSessionId),
            isNull(sessions.revokedAt)
          )
        );
    });
  }
}
