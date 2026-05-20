import { db, users, sessions } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { LoginRequest, LoginResponse } from "./login.schema";
import { verifyPassword, hashToken } from "../auth.utils";

export class LoginHandler {
  async handle(request: LoginRequest): Promise<LoginResponse> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, request.email))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error("InvalidCredentials");
    }

    const isValid = verifyPassword(request.password, user.passwordHash);
    if (!isValid) {
      throw new Error("InvalidCredentials");
    }

    // Create a new session token
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }
}
