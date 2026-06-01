import "reflect-metadata";
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
import { gamesRoutes } from "./modules/games/games.routes";
import { developersRoutes } from "./modules/games/developers.routes";
import { publishersRoutes } from "./modules/games/publishers.routes";
import { genresRoutes } from "./modules/games/genres.routes";
import { themesRoutes } from "./modules/games/themes.routes";
import { platformsRoutes } from "./modules/games/platforms.routes";
import { gameRelationsRoutes } from "./modules/games/relations.routes";
import { packagesRoutes } from "./modules/packages/packages.routes";
import { registerAuthDecorators } from "./modules/auth/auth.plugin";
import { registerLocalization } from "./shared/localization.plugin";
import { translateError } from "./shared/localization";
import { HttpError } from "./shared/http-errors";
import fastifyMultipart from "@fastify/multipart";

const isProduction = process.env.NODE_ENV === "production";

export const app = Fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024,
});

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

// Register rate limit (global default; per-route overrides on sensitive endpoints)
app.register(fastifyRateLimit, {
  global: true,
  max: 100,
  timeWindow: "1 minute",
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
app.register(developersRoutes, { prefix: "/api/games" });
app.register(publishersRoutes, { prefix: "/api/games" });
app.register(genresRoutes, { prefix: "/api/games" });
app.register(themesRoutes, { prefix: "/api/games" });
app.register(platformsRoutes, { prefix: "/api/games" });
app.register(gamesRoutes, { prefix: "/api/games" });
app.register(gameRelationsRoutes, { prefix: "/api/games" });
app.register(packagesRoutes, { prefix: "/api/packages" });

export default async function handler(req: any, res: any) {
  await app.ready();
  app.server.emit("request", req, res);
}
