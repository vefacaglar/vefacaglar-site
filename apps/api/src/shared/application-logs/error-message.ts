const secretVariables = [
  "LOG_TYPESENSE_API_KEY",
  "TYPESENSE_API_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IGDB_CLIENT_SECRET",
  "JOB_STREAM_TOKEN_SECRET",
  "OIDC_CLIENT_SECRET",
];


/** Extract a bounded diagnostic excerpt. Never use the exception's request, body or parameter fields. */
export function logErrorMessage(message: string): string | undefined {
  let excerpt = message.split(/[\r\n\u2028\u2029]/, 1)[0].trim();
  if (!excerpt || excerpt.length > 8192) return;

  for (const name of secretVariables) {
    const value = process.env[name];
    if (value) excerpt = excerpt.replaceAll(value, "[redacted]");
  }
  const databaseUrl = process.env.DATABASE_URL;
  const password = databaseUrl && URL.canParse(databaseUrl) ? new URL(databaseUrl).password : "";
  if (password) {
    excerpt = excerpt.replaceAll(password, "[redacted]");
    try {
      excerpt = excerpt.replaceAll(decodeURIComponent(password), "[redacted]");
    } catch {
      // Keep the encoded password redacted even if the URL has invalid escapes.
    }
  }

  excerpt = excerpt
    .replace(/\b(?:with args beginning with|(?:request |response )?(?:body|payload|params|parameters))\s*[:=].*$/i, "[redacted]")
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, "[redacted URL]")
    .replace(/\b(?:Bearer|Basic)\s+[\w.+\/=-]{8,}/g, "[redacted authorization]")
    .replace(/\b(?:authorization|(?:set-)?cookie)\s*[:=].*$/i, "[redacted authorization]")
    .replace(/\b(?:password|passwd|secret|(?:access[_-]?)?token|(?:x-typesense-)?api[_-]?key)\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi, "[redacted credential]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[redacted token]")
    .replace(/"(?:\\.|[^"\\])*"|`[^`]*`|(?<!\w)'(?:\\.|[^'\\])*'/g, "[redacted]")
    .replace(/(?:\[(?!redacted(?: [a-z]+)?\])|[{<]).*$/, "[redacted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();

  return excerpt.length > 400 ? `${excerpt.slice(0, 400)}…` : excerpt || undefined;
}
