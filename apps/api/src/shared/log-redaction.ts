/** Query parameters whose values must never reach the logs (e.g. job stream tokens). */
const SECRET_QUERY_PARAMS = ["token"];

const SECRET_PARAM_PATTERN = new RegExp(`([?&](?:${SECRET_QUERY_PARAMS.join("|")})=)[^&#]*`, "gi");

/** Replaces the values of secret query parameters in a request URL with `[REDACTED]`. */
export function redactUrlSecrets(url: string | undefined): string | undefined {
  if (!url || !url.includes("?")) return url;
  return url.replace(SECRET_PARAM_PATTERN, "$1[REDACTED]");
}

interface LoggableRequest {
  method?: string;
  url?: string;
  host?: string;
  ip?: string;
  headers?: Record<string, unknown>;
  socket?: { remotePort?: number };
}

/** Fastify's default `req` log serializer with secret query values redacted. */
export function serializeRequestForLog(req: LoggableRequest) {
  return {
    method: req.method,
    url: redactUrlSecrets(req.url),
    version: typeof req.headers?.["accept-version"] === "string" ? req.headers["accept-version"] : undefined,
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  };
}
