import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, users, sessions } from "@vefacaglar/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { scryptSync, randomBytes, createHash } from "crypto";

function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  const inputHash = scryptSync(password, salt, 64).toString("hex");
  return inputHash === hash;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticateRequest(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.substring(7);
  const tokenHash = hashToken(token);

  const [session] = await db
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

  if (!session) {
    throw new Error("Unauthorized");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new Error("Unauthorized");
  }

  return { user, session };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /login
  app.post(
    "/login",
    {
      schema: {
        description: "User login to retrieve a session token",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Successful login",
            type: "object",
            properties: {
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  displayName: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
          400: {
            description: "Bad request",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as any;

      if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        return reply.status(400).send({ message: "E-posta ve şifre gereklidir." });
      }

      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.isActive) {
          return reply.status(401).send({ message: "Geçersiz e-posta veya şifre." });
        }

        const isValid = verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return reply.status(401).send({ message: "Geçersiz e-posta veya şifre." });
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
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ message: "Giriş işlemi sırasında bir hata oluştu." });
      }
    }
  );

  // GET /me
  app.get(
    "/me",
    {
      schema: {
        description: "Get current user profile information",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "User profile",
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  displayName: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { user } = await authenticateRequest(request);
        return {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
        };
      } catch (error) {
        return reply.status(401).send({ message: "Yetkisiz erişim. Lütfen oturum açın." });
      }
    }
  );

  // POST /logout
  app.post(
    "/logout",
    {
      schema: {
        description: "Revoke the current session token",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "Successful logout",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { session } = await authenticateRequest(request);

        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.id, session.id));

        return { message: "Oturum başarıyla kapatıldı." };
      } catch (error) {
        return reply.status(401).send({ message: "Yetkisiz işlem." });
      }
    }
  );
}
