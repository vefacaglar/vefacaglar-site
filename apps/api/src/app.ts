import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyRateLimit from "@fastify/rate-limit";
import { authRoutes } from "./modules/auth/auth.routes";
import { postsRoutes } from "./modules/posts/posts.routes";
import { pagesRoutes } from "./modules/pages/pages.routes";
import { authorsRoutes } from "./modules/authors/authors.routes";
import { projectsRoutes } from "./modules/projects/projects.routes";
import { uploadsRoutes } from "./modules/uploads/uploads.routes";
import { localizationsRoutes } from "./modules/localizations/localizations.routes";
import { registerAuthDecorators } from "./modules/auth/auth.plugin";
import { registerLocalization } from "./shared/localization.plugin";
import { translateError } from "./shared/localization";
import { HttpError } from "./shared/http-errors";
import fastifyMultipart from "@fastify/multipart";

export const app = Fastify({ logger: true });

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

// Register Swagger
app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Vefa Çağlar Site API",
      description: "Personal Website API documentation",
      version: "0.1.0",
    },
    servers: [
      {
        url: "http://localhost:3001",
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

// Register Swagger UI
app.register(fastifySwaggerUi, {
  routePrefix: "/swagger",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false,
  },
});

app.get("/health", async () => {
  return { status: "ok" };
});

registerAuthDecorators(app);

app.setErrorHandler((err, request, reply) => {
  if (err instanceof HttpError) {
    const translatedMsg = translateError(err.message, request.lang);
    return reply.status(err.statusCode).send({ message: translatedMsg });
  }
  const fastifyErr = err as { validation?: unknown; message?: string };
  if (fastifyErr.validation) {
    return reply.status(400).send({ message: fastifyErr.message ?? "Validation error." });
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
