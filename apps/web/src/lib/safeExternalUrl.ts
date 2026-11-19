/**
 * Returns `url` only when it is an absolute http(s) URL, otherwise undefined.
 * Use for admin-entered links rendered into `href` so schemes like `javascript:` never reach the page.
 */
export function safeExternalUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
