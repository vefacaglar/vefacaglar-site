import { basename, dirname, resolve } from "node:path";
import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";
import { Errors as TypesenseErrors } from "typesense";
import { HttpError } from "../http-errors";
import en from "../locales/en.json";

const databaseReasons: Record<string, string> = {
  "08006": "Postgres connection failed",
  "22001": "A value exceeds the database column's length limit",
  "22003": "A numeric value is outside the database column's range",
  "22P02": "Postgres rejected a value with an invalid format",
  "23502": "A required database value is missing",
  "23503": "A referenced database record does not exist or is still in use",
  "23505": "A database value conflicts with a unique constraint",
  "23514": "A value violates a database check constraint",
  "28P01": "Postgres rejected authentication",
  "3D000": "The configured Postgres database does not exist",
  "40001": "Postgres aborted a concurrent transaction",
  "40P01": "Postgres detected a deadlock",
  "42501": "The Postgres role lacks the required permissions",
  "42703": "A database column is missing. Check migrations",
  "42P01": "A database table is missing. Check migrations",
  "57014": "The Postgres query was cancelled or timed out",
};

const runtimeReasons: Record<string, string> = {
  EADDRINUSE: "The listen address is already in use",
  EACCES: "The process lacks the required permissions",
  ECONNREFUSED: "A dependency refused the connection",
  ECONNRESET: "A dependency reset the connection",
  ENOTFOUND: "A dependency hostname could not be resolved",
  EAI_AGAIN: "DNS lookup for a dependency failed temporarily",
  ETIMEDOUT: "A dependency connection timed out",
  UND_ERR_CONNECT_TIMEOUT: "Connecting to a dependency timed out",
  UND_ERR_HEADERS_TIMEOUT: "Waiting for a dependency response timed out",
  CONNECTION_ENDED: "The Postgres connection closed",
  CONNECTION_CLOSED: "The Postgres connection closed unexpectedly",
  CONNECT_TIMEOUT: "Connecting to Postgres timed out",
  FST_ERR_VALIDATION: "The request did not match the endpoint schema",
  FST_ERR_CTP_INVALID_JSON_BODY: "The request body contains invalid JSON",
  FST_ERR_CTP_EMPTY_JSON_BODY: "The request has an empty JSON body",
  FST_ERR_FAILED_ERROR_SERIALIZATION: "Fastify could not serialize the error response",
  FST_ERR_RESPONSE_SERIALIZATION: "The response did not match the endpoint schema",
  ERR_JWT_EXPIRED: "The identity token has expired",
  ERR_JWT_CLAIM_VALIDATION_FAILED: "The identity token did not match the required claims",
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: "The identity token signature could not be verified",
  ERR_JWKS_TIMEOUT: "Fetching identity provider signing keys timed out",
  ERR_JWKS_NO_MATCHING_KEY: "No signing key matched the identity token",
  SEARCH_TIMEOUT: "The search operation timed out",
};

const appRoot = resolve(__dirname, "../..");
const frameRoots = [resolve(dirname(appRoot), "src"), appRoot];
const maxStackFrames = 12;
const typesenseReasons: Record<number, string> = {
  400: "Typesense rejected an invalid request",
  401: "Typesense rejected the API key",
  403: "The Typesense API key lacks the required permissions",
  404: "The requested Typesense collection or document was not found",
  409: "The Typesense collection or document already exists",
  422: "Typesense could not process the document",
};

function applicationFrames(error: Error, limit: number): string[] {
  const stack = error.stack;
  if (typeof stack !== "string") return [];

  // Skip the entire exception header, which may contain multiple lines of input.
  const header = Error.prototype.toString.call(error);
  if (!stack.startsWith(`${header}\n`)) return [];

  const frames: string[] = [];
  for (const line of stack.slice(header.length + 1).split("\n")) {
    const frame = line.trimStart();
    if (!frame.startsWith("at ")) continue;
    for (const root of frameRoots) {
      const start = frame.indexOf(`${root}/`);
      if (start === -1) continue;
      const location = frame.slice(start + root.length + 1).replace(/\)$/, "");
      if (!/^(?:[\w-]+\/)*[\w.-]+\.[cm]?[jt]s:\d+:\d+$/.test(location)) continue;
      frames.push(`${basename(root)}/${location}`);
      break;
    }
    if (frames.length === limit) break;
  }
  return frames;
}

export function describeLogError(error: unknown, reportedAt?: Error) {
  let reason: string | undefined;
  let error_code: string | undefined;
  let error_type: string | undefined;
  let source: string | undefined;
  let current = error;
  let remainingFrames = maxStackFrames;
  const traces: string[] = [];

  // Follow wrapped errors without exporting SQL, parameters, or arbitrary exception text.
  for (let depth = 0; depth < 8 && current instanceof Error; depth++) {
    const frames = applicationFrames(current, Math.max(1, remainingFrames));
    source = frames[0] ?? source;
    const type = current.constructor?.name;
    const safeType = typeof type === "string" && /^[\w]{1,64}$/.test(type) ? type : undefined;
    error_type = safeType ?? error_type;
    if (remainingFrames > 0 && frames.length > 0) {
      traces.push([safeType ?? "Error", ...frames.map((frame) => `  at ${frame}`)].join("\n"));
      remainingFrames -= frames.length;
    }

    if (current instanceof postgres.PostgresError && /^[A-Z0-9]{5}$/.test(current.code)) {
      error_code = `sqlstate_${current.code}`;
      reason = databaseReasons[current.code] ?? `Postgres rejected the query (${current.code})`;
      // The driver exposes schema identifiers separately from SQL and row values.
      const identifiers = [current.table_name, current.column_name, current.constraint_name]
        .filter((name): name is string => typeof name === "string" && /^[a-z_][a-z0-9_]{0,62}$/.test(name));
      if (identifiers.length) reason += ` (${identifiers.join(", ")})`;
      break;
    }

    const code = (current as Error & { code?: unknown }).code;
    if (current instanceof TypesenseErrors.TypesenseError &&
        typeof current.httpStatus === "number" && Number.isInteger(current.httpStatus)) {
      const status = current.httpStatus;
      error_code = `typesense_http_${status}`;
      reason = typesenseReasons[status] ?? `Typesense returned HTTP ${status}`;
    } else if (typeof code === "string" && Object.hasOwn(runtimeReasons, code)) {
      error_code = code;
      reason = runtimeReasons[code];
    } else if (current instanceof DrizzleQueryError) {
      reason ??= "A database query failed";
    } else if (current instanceof HttpError) {
      const logMessage = current.logMessage;
      if (Object.hasOwn(en, logMessage)) {
        error_code = logMessage;
        reason = en[logMessage as keyof typeof en];
      } else {
        reason = logMessage;
      }
      reason = reason.replace(/\.$/, "");
    } else if (current instanceof TypeError && /^Cannot (read|set) properties of (null|undefined)\b/.test(current.message)) {
      reason ??= "The API tried to use a missing value";
    }
    current = current.cause;
  }

  if (!source && reportedAt) {
    const frames = applicationFrames(reportedAt, maxStackFrames);
    if (frames.length) {
      source = frames[0];
      traces.push(["Reported at", ...frames.map((frame) => `  at ${frame}`)].join("\n"));
    }
  }
  const stack = traces.length ? traces.join("\nCaused by ") : undefined;
  return { reason, error_code, error_type, source, stack };
}
