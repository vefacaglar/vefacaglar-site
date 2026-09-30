import { sessions, users } from "@vefacaglar/db";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { injectable } from "tsyringe";
import { DbProvider } from "../../db.provider";
import type { IUsersRepository } from "./users.repository.interface";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

@injectable()
export class DrizzleUsersRepository implements IUsersRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.dbProvider.client.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.dbProvider.client.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const [row] = await this.dbProvider.client.select().from(users).where(eq(users.username, username)).limit(1);
    return row ?? null;
  }

  async findByOidcSubject(issuer: string, subject: string): Promise<User | null> {
    const [row] = await this.dbProvider.client
      .select()
      .from(users)
      .where(and(eq(users.oidcIssuer, issuer), eq(users.oidcSubject, subject)))
      .limit(1);
    return row ?? null;
  }

  async linkOidc(userId: string, issuer: string, subject: string): Promise<User> {
    const [row] = await this.dbProvider.client
      .update(users)
      .set({ oidcIssuer: issuer, oidcSubject: subject, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async create(user: NewUser): Promise<User> {
    const [row] = await this.dbProvider.client.insert(users).values(user).returning();
    return row;
  }

  async updateLastLogin(id: string): Promise<void> {
    const now = new Date();
    await this.dbProvider.client.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, id));
  }

  /**
   * Updates profile fields with an in-transaction email uniqueness check against other users.
   * The username is intentionally not editable. Throws "EmailAlreadyExists" on conflict.
   */
  async updateProfile(
    userId: string,
    patch: { email: string; displayName: string }
  ): Promise<User> {
    return await this.dbProvider.transaction(async () => {
      const emailExists = await this.dbProvider.client
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, patch.email), ne(users.id, userId)))
        .limit(1);
      if (emailExists.length > 0) {
        throw new Error("EmailAlreadyExists");
      }

      const [row] = await this.dbProvider.client
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
    await this.dbProvider.transaction(async () => {
      await this.dbProvider.client
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: now })
        .where(eq(users.id, userId));

      await this.dbProvider.client
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
