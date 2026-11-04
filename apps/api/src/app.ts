import "reflect-metadata";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import { authRoutes } from "./modules/auth/auth.routes";
import { postsRoutes } from "./modules/posts/posts.routes";
import { pagesRoutes } from "./modules/pages/pages.routes";
import { authorsRoutes } from "./modules/authors/authors.routes";
import { projectsRoutes } from "./modules/projects/projects.routes";
import { uploadsRoutes } from "./modules/uploads/uploads.routes";
import { localizationsRoutes } from "./modules/localizations/localizations.routes";
import { gamesRoutes } from "./modules/catalog/games.routes";
import { publicGamesRoutes } from "./modules/games/games.routes";
import { developersRoutes } from "./modules/catalog/developers.routes";
import { publishersRoutes } from "./modules/catalog/publishers.routes";
import { genresRoutes } from "./modules/catalog/genres.routes";
import { themesRoutes } from "./modules/catalog/themes.routes";
import { platformsRoutes } from "./modules/catalog/platforms.routes";
import { gameRelationsRoutes } from "./modules/catalog/relations.routes";
import { packagesRoutes } from "./modules/packages/packages.routes";
import { jobsRoutes } from "./modules/jobs/jobs.routes";
import { registerAuthDecorators } from "./modules/auth/auth.plugin";
import { registerLocalization } from "./shared/localization.plugin";
import { translateError } from "./shared/localization";
import { HttpError } from "./shared/http-errors";
import { serializeRequestForLog } from "./shared/log-redaction";
import { installApplicationLogs } from "./shared/application-logs/application-logs";
import { createRedisClient, readRedisConfig } from "./shared/search/redis.client";
import fastifyMultipart from "@fastify/multipart";

const isProduction = process.env.NODE_ENV === "production";

export const app = Fastify({
  // Request URLs are logged; secret query values (job stream `?token=`) are redacted.
  logger: { serializers: { req: serializeRequestForLog } },
  requestIdHeader: false,
  genReqId: () => randomUUID(),
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024,
});

export const applicationLogs = installApplicationLogs(app);

// Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, ...)
app.register(fastifyHelmet, {
  contentSecurityPolicy: false,
});

// CORS — allow only the configured web origin
const webOrigins = (process.env.WEB_URL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.register(fastifyCors, {
  origin: webOrigins.length > 0 ? webOrigins : false,
  credentials: false,
});

// Register localization plugin
registerLocalization(app);

// Register multipart support for secure file uploads (10MB limit)
app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Register rate limit (global default; per-route overrides on sensitive endpoints).
// Serverless instances don't share memory, so counters live in Redis when it is configured.
// skipOnError keeps the API up if Redis is unreachable.
const rateLimitRedis = readRedisConfig();
app.register(fastifyRateLimit, {
  global: true,
  max: 100,
  timeWindow: "1 minute",
  ...(rateLimitRedis && {
    redis: createRedisClient(rateLimitRedis),
    nameSpace: "rate-limit:",
    skipOnError: true,
  }),
});

// Swagger — disabled in production to avoid exposing the admin API surface
if (!isProduction) {
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Vefa Çağlar Site API",
        description: "Personal Website API documentation",
        version: "0.1.0",
      },
      servers: [
        {
          url: process.env.API_URL ?? "/",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
  });

  app.register(fastifySwaggerUi, {
    routePrefix: "/swagger",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });
}

app.get("/health", async () => {
  return { status: "ok" };
});

registerAuthDecorators(app);

app.setErrorHandler((err, request, reply) => {
  if (err instanceof HttpError) {
    // Log server-side HTTP errors (5xx) so they are visible in production logs
    if (err.statusCode >= 500) {
      request.log.error(err, `Server HTTP Error: ${err.message}`);
    }
    const translatedMsg = translateError(err.message, request.lang);
    return reply.status(err.statusCode).send({ message: translatedMsg });
  }
  const fastifyErr = err as { validation?: unknown; message?: string; statusCode?: number };
  if (fastifyErr.validation) {
    return reply.status(400).send({ message: fastifyErr.message ?? "Validation error." });
  }
  if (fastifyErr.statusCode === 429) {
    const translatedMsg = translateError("err_rate_limit_exceeded", request.lang);
    return reply.status(429).send({ message: translatedMsg });
  }
  // Fastify/plugin client errors (bad JSON, payload too large, unsupported media type, ...).
  if (fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500) {
    return reply.status(fastifyErr.statusCode).send({ message: fastifyErr.message ?? "Bad request." });
  }
  // Postgres errors caused by client input; Drizzle wraps the driver error in `cause`.
  const pgCode = ((err as { cause?: { code?: string } }).cause ?? (err as { code?: string }))?.code;
  if (pgCode === "23505") {
    const translatedMsg = translateError("err_already_exists", request.lang);
    return reply.status(409).send({ message: translatedMsg });
  }
  if (pgCode === "22P02" || pgCode === "23503") {
    return reply.status(400).send({ message: "Invalid identifier or reference." });
  }
  request.log.error(err);
  return reply.status(500).send({ message: "Internal server error." });
});

app.register(authRoutes, { prefix: "/api/auth" });
app.register(postsRoutes, { prefix: "/api/posts" });
app.register(pagesRoutes, { prefix: "/api/pages" });
app.register(authorsRoutes, { prefix: "/api/authors" });
app.register(projectsRoutes, { prefix: "/api/projects" });
app.register(uploadsRoutes, { prefix: "/api/uploads" });
app.register(localizationsRoutes, { prefix: "/api/localizations" });
app.register(developersRoutes, { prefix: "/api/catalog" });
app.register(publishersRoutes, { prefix: "/api/catalog" });
app.register(genresRoutes, { prefix: "/api/catalog" });
app.register(themesRoutes, { prefix: "/api/catalog" });
app.register(platformsRoutes, { prefix: "/api/catalog" });
app.register(gamesRoutes, { prefix: "/api/catalog" });
app.register(gameRelationsRoutes, { prefix: "/api/catalog" });
app.register(packagesRoutes, { prefix: "/api/packages" });
app.register(publicGamesRoutes, { prefix: "/api/games" });
app.register(jobsRoutes, { prefix: "/api/jobs" });

export default async function handler(req: any, res: any) {
  await app.ready();
  app.server.emit("request", req, res);
}
