/**
 * Returns `value` only when it is a same-site path ("/blog?x=1"). Absolute,
 * protocol-relative ("//host", "/\host") and control-character URLs are
 * rejected to prevent open redirects. Safe to use in client components.
 */
export function safeInternalPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/")) return undefined;
  if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
  // Browsers strip tabs/newlines from URLs, so "/\t/host" would become "//host".
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return undefined;
  return value;
}
