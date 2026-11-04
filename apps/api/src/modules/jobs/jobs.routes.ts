import type { OutgoingHttpHeaders } from "http";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { FastifyCorsOptions } from "@fastify/cors";
import { ListJobsHandler } from "./dashboard/list/list.handler";
import { ListJobsQuery, ListJobsQuerySchema, ListJobsResponseSchema } from "./dashboard/list/list.schema";
import { EnqueueJobHandler } from "./dashboard/enqueue/enqueue.handler";
import { EnqueueJobRequest, EnqueueJobRequestSchema, EnqueueJobResponseSchema } from "./dashboard/enqueue/enqueue.schema";
import { GetJobHandler } from "./dashboard/detail/detail.handler";
import { GetJobParams, GetJobParamsSchema, GetJobQuery, GetJobQuerySchema, GetJobResponseSchema } from "./dashboard/detail/detail.schema";
import { CancelJobHandler } from "./dashboard/cancel/cancel.handler";
import { CancelJobParams, CancelJobParamsSchema, CancelJobResponseSchema } from "./dashboard/cancel/cancel.schema";
import { RetryJobHandler } from "./dashboard/retry/retry.handler";
import { RetryJobParams, RetryJobParamsSchema, RetryJobResponseSchema } from "./dashboard/retry/retry.schema";
import { ListRecurringJobsHandler } from "./dashboard/recurring-list/recurring-list.handler";
import { ListRecurringJobsResponseSchema } from "./dashboard/recurring-list/recurring-list.schema";
import { UpdateRecurringJobHandler } from "./dashboard/recurring-update/recurring-update.handler";
import {
  UpdateRecurringJobParams,
  UpdateRecurringJobParamsSchema,
  UpdateRecurringJobRequest,
  UpdateRecurringJobRequestSchema,
  UpdateRecurringJobResponseSchema,
} from "./dashboard/recurring-update/recurring-update.schema";
import { RunRecurringJobHandler } from "./dashboard/recurring-run/recurring-run.handler";
import { RunRecurringJobParams, RunRecurringJobParamsSchema, RunRecurringJobResponseSchema } from "./dashboard/recurring-run/recurring-run.schema";
import { ListWorkersHandler } from "./dashboard/workers/workers.handler";
import { ListWorkersResponseSchema } from "./dashboard/workers/workers.schema";
import { StreamJobHandler } from "./dashboard/stream/stream.handler";
import {
  StreamJobHeadersSchema,
  StreamJobParams,
  StreamJobParamsSchema,
  StreamJobQuery,
  StreamJobQuerySchema,
  StreamJobResponseSchema,
} from "./dashboard/stream/stream.schema";
import type { JobStream } from "./dashboard/stream/job-stream";
import { SSE_HEADERS } from "./dashboard/stream/stream.sse";
import { readStreamCorsOrigins } from "./dashboard/stream/stream.cors";
import { CreateStreamTokenHandler } from "./dashboard/stream-token/stream-token.handler";
import {
  CreateStreamTokenParams,
  CreateStreamTokenParamsSchema,
  CreateStreamTokenResponseSchema,
} from "./dashboard/stream-token/stream-token.schema";
import { JOB_EVENTS_LISTENER, JOB_STREAM_TOKEN_SERVICE } from "./jobs.tokens";
import type { IJobEventsListener } from "./job-events.listener.interface";
import type { IJobStreamTokenService } from "./job-stream-token.service.interface";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { UnauthorizedError } from "../../shared/http-errors";
import { container } from "../../container";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Route-level @fastify/cors options, merged over the global ones by its hook. */
    cors?: false | Partial<FastifyCorsOptions>;
  }
}

const TAGS = ["Jobs"];
const SECURITY = [{ bearerAuth: [] }];

export async function jobsRoutes(app: FastifyInstance) {
  const listHandler = container.resolve(ListJobsHandler);
  const enqueueHandler = container.resolve(EnqueueJobHandler);
  const detailHandler = container.resolve(GetJobHandler);
  const cancelHandler = container.resolve(CancelJobHandler);
  const retryHandler = container.resolve(RetryJobHandler);
  const listRecurringHandler = container.resolve(ListRecurringJobsHandler);
  const updateRecurringHandler = container.resolve(UpdateRecurringJobHandler);
  const runRecurringHandler = container.resolve(RunRecurringJobHandler);
  const workersHandler = container.resolve(ListWorkersHandler);
  const streamHandler = container.resolve(StreamJobHandler);
  const streamTokenHandler = container.resolve(CreateStreamTokenHandler);
  const streamTokens = container.resolve<IJobStreamTokenService>(JOB_STREAM_TOKEN_SERVICE);

  /**
   * Route-level @fastify/cors options for the stream (merged into the global
   * CORS hook): the browser connects directly from `WEB_ORIGINS`. The hook runs
   * on `onRequest`, so the headers are on the reply before auth and therefore
   * also on 401/404 responses; the stream copies them into its raw head.
   * Disallowed origins simply get no CORS headers.
   */
  const streamCors = {
    origin: readStreamCorsOrigins(),
    methods: "GET",
    allowedHeaders: "Last-Event-ID",
    credentials: false,
  };

  /**
   * Stream auth: `?token=` (job-scoped stream token, checked at connect time
   * only) or, without a token, the regular Bearer admin session.
   */
  const requireAdminOrStreamToken = async (
    request: FastifyRequest<{ Params: StreamJobParams; Querystring: StreamJobQuery }>,
    reply: FastifyReply
  ) => {
    const { token } = request.query;
    if (token === undefined) {
      await runHook(app.requireAdmin, app, request, reply);
      return;
    }
    const user = await streamTokens.authorize(token, request.params.id);
    if (!user) {
      throw new UnauthorizedError("err_stream_token_invalid");
    }
    request.user = user;
  };

  // Open SSE streams; ended before the server closes so `app.close()` is not
  // held up by long-lived hijacked responses.
  const openStreams = new Set<JobStream>();
  app.addHook("preClose", async () => {
    for (const stream of [...openStreams]) stream.finish();
  });
  app.addHook("onClose", async () => {
    await container.resolve<IJobEventsListener>(JOB_EVENTS_LISTENER).stop();
  });

  app.get<{ Querystring: ListJobsQuery }>("/dashboard", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List background jobs (newest first)",
      tags: TAGS,
      security: SECURITY,
      querystring: ListJobsQuerySchema,
      response: { 200: ListJobsResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.post<{ Body: EnqueueJobRequest }>("/dashboard", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Enqueue a background job",
      tags: TAGS,
      security: SECURITY,
      body: EnqueueJobRequestSchema,
      response: { 201: EnqueueJobResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request, reply) => reply.code(201).send(await enqueueHandler.handle(request)));

  app.get("/dashboard/recurring", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List recurring job definitions",
      tags: TAGS,
      security: SECURITY,
      response: { 200: ListRecurringJobsResponseSchema, 401: ErrorResponseSchema },
    },
  }, () => listRecurringHandler.handle());

  app.put<{ Params: UpdateRecurringJobParams; Body: UpdateRecurringJobRequest }>("/dashboard/recurring/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Enable/disable a recurring job or change its cron expression",
      tags: TAGS,
      security: SECURITY,
      params: UpdateRecurringJobParamsSchema,
      body: UpdateRecurringJobRequestSchema,
      response: { 200: UpdateRecurringJobResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => updateRecurringHandler.handle(request));

  app.post<{ Params: RunRecurringJobParams }>("/dashboard/recurring/:id/run", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Enqueue a recurring job immediately",
      tags: TAGS,
      security: SECURITY,
      params: RunRecurringJobParamsSchema,
      response: { 201: RunRecurringJobResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request, reply) => reply.code(201).send(await runRecurringHandler.handle(request)));

  app.get("/dashboard/workers", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List registered workers and whether they are online",
      tags: TAGS,
      security: SECURITY,
      response: { 200: ListWorkersResponseSchema, 401: ErrorResponseSchema },
    },
  }, () => workersHandler.handle());

  app.get<{ Params: GetJobParams; Querystring: GetJobQuery }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get a job with its logs after `afterLogId` (max 200, ascending)",
      tags: TAGS,
      security: SECURITY,
      params: GetJobParamsSchema,
      querystring: GetJobQuerySchema,
      response: { 200: GetJobResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => detailHandler.handle(request));

  app.post<{ Params: CreateStreamTokenParams }>("/dashboard/:id/stream-token", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Issue a short-lived (120 s) token to open this job's stream directly from the browser",
      tags: TAGS,
      security: SECURITY,
      params: CreateStreamTokenParamsSchema,
      response: { 201: CreateStreamTokenResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const result = await streamTokenHandler.handle(request);
    return reply.code(201).header("cache-control", "no-store").send(result);
  });

  // CORS preflight for direct browser connections (answered by the CORS hook with 204).
  app.options("/dashboard/:id/stream", {
    config: { cors: streamCors },
    schema: { hide: true },
  }, (_request, reply) => reply.code(204).send());

  app.get<{ Params: StreamJobParams; Querystring: StreamJobQuery }>("/dashboard/:id/stream", {
    preHandler: requireAdminOrStreamToken,
    config: { cors: streamCors },
    schema: {
      description:
        "Live job progress and logs as Server-Sent Events (`snapshot`, `log`, `done`). " +
        "Auth: Bearer admin session or `?token=` from `POST .../stream-token`. " +
        "`Last-Event-ID` overrides `afterLogId`; without a cursor the last 500 logs are sent.",
      tags: TAGS,
      security: [{ bearerAuth: [] }, {}],
      params: StreamJobParamsSchema,
      querystring: StreamJobQuerySchema,
      headers: StreamJobHeadersSchema,
      response: {
        200: {
          description: "Event stream",
          content: { "text/event-stream": { schema: StreamJobResponseSchema } },
        },
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    // Throws (404) before anything is streamed -> regular JSON error response.
    const stream = await streamHandler.handle(request);

    reply.hijack();
    const res = reply.raw;
    // Keep headers already set by hooks (CORS, helmet, rate limit) — hijacked
    // replies do not send them automatically. No compression is registered;
    // `no-transform` also tells proxies not to buffer/compress the stream.
    const headers: OutgoingHttpHeaders = { ...SSE_HEADERS };
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined && !(name.toLowerCase() in SSE_HEADERS)) headers[name] = value;
    }
    res.writeHead(200, headers);
    request.raw.socket?.setNoDelay(true);

    openStreams.add(stream);
    // `res` "close" fires on client disconnect and after end(); unlike
    // `request.raw` "close", it is not emitted early once the request body is read.
    res.on("close", () => stream.close());
    res.on("drain", () => stream.resume());

    stream.start(
      {
        write: (chunk) => (res.writableEnded || res.destroyed ? false : res.write(chunk)),
        end: () => {
          if (!res.writableEnded && !res.destroyed) res.end();
        },
      },
      () => openStreams.delete(stream)
    );
  });

  app.post<{ Params: CancelJobParams }>("/dashboard/:id/cancel", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Cancel a job (queued: immediately; running: request cancellation)",
      tags: TAGS,
      security: SECURITY,
      params: CancelJobParamsSchema,
      response: { 200: CancelJobResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => cancelHandler.handle(request));

  app.post<{ Params: RetryJobParams }>("/dashboard/:id/retry", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Retry a failed or cancelled job, resuming from its checkpoint",
      tags: TAGS,
      security: SECURITY,
      params: RetryJobParamsSchema,
      response: { 200: RetryJobResponseSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, (request) => retryHandler.handle(request));
}

/** Runs a Fastify hook that may be callback- or promise-style. */
function runHook(
  hook: FastifyInstance["requireAdmin"],
  app: FastifyInstance,
  request: FastifyRequest<any>,
  reply: FastifyReply
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (err?: Error | null) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    const result: unknown = hook.call(app, request, reply, done);
    if (result && typeof (result as Promise<void>).then === "function") {
      (result as Promise<void>).then(() => done(), (err: Error) => done(err));
    }
  });
}
