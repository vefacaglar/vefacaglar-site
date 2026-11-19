/**
 * Encodes one API path segment. Route params may arrive already percent-encoded
 * (non-ASCII slugs), so decode first to avoid double encoding.
 */
export function seg(value: string | number): string {
  const raw = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return encodeURIComponent(raw);
  }
}
