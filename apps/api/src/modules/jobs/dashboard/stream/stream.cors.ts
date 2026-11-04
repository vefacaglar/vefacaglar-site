/** Browser origins allowed to open the job stream directly (no credentials). */
export const DEFAULT_STREAM_ORIGINS: readonly string[] = ["https://vefacaglar.com", "https://www.vefacaglar.com"];
const DEV_STREAM_ORIGIN = "http://localhost:3000";

/**
 * `WEB_ORIGINS` (comma-separated, exact origins) or the production defaults;
 * outside production `http://localhost:3000` is always added.
 */
export function readStreamCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .map((origin) => (/^https?:\/\//i.test(origin) ? origin : `https://${origin}`));
  const origins = configured.length > 0 ? configured : [...DEFAULT_STREAM_ORIGINS];
  if (env.NODE_ENV !== "production" && !origins.includes(DEV_STREAM_ORIGIN)) {
    origins.push(DEV_STREAM_ORIGIN);
  }
  return origins;
}
