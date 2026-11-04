import { STATUS_CODES } from "node:http";
import type { FastifyInstance, FastifyRequest } from "fastify";
import schema from "./application_logs_v1.json";
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

interface LogDocument extends LogEvent {
  timestamp: number;
  service: string;
  environment: string;
}

const service = "vefacaglar-site-api";
const queueCapacity = 256;
const requestTimeoutMs = 2_000;
const shutdownTimeoutMs = 3_000;

class TypesenseLogSink {
  private readonly queue: LogDocument[] = [];
  private readonly shutdown = new AbortController();
  private draining?: Promise<void>;
  private closed = false;
  private overflowReported = false;
  private deliveryFailed = false;

  constructor(
    private readonly collectionsUrl: string,
    private readonly key: string,
    private readonly logger: FastifyInstance["log"],
  ) {}

  enqueue(document: LogDocument): void {
    if (this.closed) return;
    if (this.queue.length >= queueCapacity) {
      if (!this.overflowReported) {
        this.logger.warn("Typesense log queue full; dropping remote events");
        this.overflowReported = true;
      }
      return;
    }
    this.queue.push(document);
    this.draining ??= Promise.resolve().then(() => this.drain());
  }

  async close(): Promise<void> {
    this.closed = true;
    const timeout = setTimeout(() => {
      this.logger.warn("Typesense log flush interrupted");
      this.shutdown.abort();
    }, shutdownTimeoutMs);
    try {
      await this.draining;
    } finally {
      clearTimeout(timeout);
      this.queue.length = 0;
    }
  }

  private async drain(): Promise<void> {
    while (this.queue.length && !this.shutdown.signal.aborted) {
      const document = this.queue.shift()!;
      try {
        await this.send(document);
        if (this.deliveryFailed) this.logger.info("Typesense log delivery resumed");
        this.deliveryFailed = false;
      } catch {
        if (!this.deliveryFailed && !this.shutdown.signal.aborted) {
          this.logger.warn("Typesense log delivery failed; events remain on stdout");
        }
        this.deliveryFailed = true;
      }
    }
    this.draining = undefined;
  }

  private async send(document: LogDocument): Promise<void> {
    const documentsUrl = `${this.collectionsUrl}/${schema.name}/documents`;
    let status = await this.post(documentsUrl, document);
    if (status === 404) {
      const createStatus = await this.post(this.collectionsUrl, schema);
      if (createStatus !== 409 && (createStatus < 200 || createStatus >= 300)) {
        throw new Error("Could not create Typesense log collection");
      }
      status = await this.post(documentsUrl, document);
    }
    if (status < 200 || status >= 300) throw new Error("Typesense rejected log event");
  }

  private async post(url: string, data: LogDocument | typeof schema): Promise<number> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-TYPESENSE-API-KEY": this.key },
      body: JSON.stringify(data),
      redirect: "error",
      signal: AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(requestTimeoutMs)]),
    });
    await response.body?.cancel();
    return response.status;
  }
}

function configureSink(logger: FastifyInstance["log"]): TypesenseLogSink | undefined {
  const rawUrl = process.env.LOG_TYPESENSE_URL?.trim();
  const key = process.env.LOG_TYPESENSE_API_KEY?.trim();
  if (!rawUrl && !key) return;

  const url = rawUrl && URL.canParse(rawUrl) ? new URL(rawUrl) : undefined;
  if (!key || !url || !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash) {
    logger.warn("Typesense log export requires LOG_TYPESENSE_URL and LOG_TYPESENSE_API_KEY");
    return;
  }
  return new TypesenseLogSink(`${url.href.replace(/\/+$/, "")}/collections`, key, logger);
}

export function installApplicationLogs(app: FastifyInstance) {
  const environment = process.env.LOG_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
  const sink = configureSink(app.log);
  const requestErrors = new WeakMap<FastifyRequest, Error>();

  function write(event: LogEvent, logger = app.log, error?: unknown, reportedAt?: Error): void {
    const { reason, ...details } = describeLogError(error, reportedAt);
    const explanation = reason ?? (!reportedAt && details.error_type && (
      details.source ? `${details.error_type} at ${details.source}` : details.error_type
    ));
    const message = explanation ? `${explanation} | ${event.message}` : event.message;
    const document = { ...event, ...details, message, timestamp: Date.now(), service, environment };
    const { level, message: logMessage, ...fields } = document;
    const method = level === "warning" ? "warn" : level;
    logger[method](reportedAt && error instanceof Error
      ? { ...fields, error_message: error.message }
      : fields, logMessage);
    sink?.enqueue(document);
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
    await sink?.close();
  };
  app.addHook("onClose", close);
  return { write, close };
}
