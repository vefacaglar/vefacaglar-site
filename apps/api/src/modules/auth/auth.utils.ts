import { scryptSync, randomBytes, createHash, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const stored = Buffer.from(hashHex, "hex");
  const input = scryptSync(password, salt, 64);
  if (stored.length !== input.length) return false;
  return timingSafeEqual(stored, input);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
