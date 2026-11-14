import { STATUS_CODES } from "node:http";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { describeLogError } from "./error-details";
import { bindRuntimeFailureReporter } from "./runtime-failures";

interface LogEvent {
  level: "info" | "warning" | "error";
  event: string;
  message: string;
  request_id?: string;
  http_method?: string;
  http_route?: string;
  http_status?: number;
}

const service = "vefacaglar-site-api";

export function installApplicationLogs(app: FastifyInstance) {
  const environment = process.env.LOG_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
  const requestErrors = new WeakMap<FastifyRequest, Error>();

  /** Structured stdout (pino) is the only destination; the container log shipper collects it. */
  function write(event: LogEvent, logger = app.log, error?: unknown, reportedAt?: Error): void {
    const { reason, ...details } = describeLogError(error, reportedAt);
    const explanation = reason ?? (!reportedAt && details.error_type && (
      details.source ? `${details.error_type} at ${details.source}` : details.error_type
    ));
    const message = explanation ? `${explanation} | ${event.message}` : event.message;
    const { level, message: logMessage, ...fields } = { ...event, ...details, message, timestamp: Date.now(), service, environment };
    const method = level === "warning" ? "warn" : level;
    logger[method](reportedAt && error instanceof Error
      ? { ...fields, error_message: error.message }
      : fields, logMessage);
  }

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
  });

  app.addHook("onError", async (request, _reply, error) => {
    requestErrors.set(request, error);
  });

  app.addHook("onResponse", async (request, reply) => {
    const status = reply.statusCode;
    const serverError = status >= 500;
    if (status < 400) return;

    const route = request.routeOptions.url;
    const statusText = STATUS_CODES[status];
    const description = statusText ? `HTTP ${status} ${statusText}` : `HTTP ${status}`;
    write({
      level: serverError ? "error" : "warning",
      event: serverError ? "http_request_failed" : "http_request_rejected",
      message: `${request.method}${route ? ` ${route}` : ""} returned ${description}`,
      request_id: request.id,
      http_method: request.method,
      http_route: route,
      http_status: status,
    }, request.log, requestErrors.get(request));
  });

  const unbindReporter = bindRuntimeFailureReporter((event, error, reportedAt) =>
    write(event, app.log, error, reportedAt));
  const close = async () => {
    unbindReporter();
  };
  app.addHook("onClose", close);
  return { write, close };
}
