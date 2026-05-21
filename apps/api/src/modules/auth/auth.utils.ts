import { scryptSync, randomBytes, createHash } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const parts = passwordHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  const inputHash = scryptSync(password, salt, 64).toString("hex");
  return inputHash === hash;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
