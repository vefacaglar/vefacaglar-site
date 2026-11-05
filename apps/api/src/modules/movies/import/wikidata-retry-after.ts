/** Parse an upstream cooldown without shortening a valid long Retry-After. */
export function wikidataRetryAfter(raw: string | null, now = Date.now()): Date | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  const milliseconds = /^\d+$/.test(value) ? now + Number(value) * 1000 : Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  const parsed = new Date(milliseconds);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}
