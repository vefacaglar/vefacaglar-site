import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyRateLimit from "@fastify/rate-limit";
import { authRoutes } from "./modules/auth/auth.routes";
import { postsRoutes } from "./modules/posts/posts.routes";
import { pagesRoutes } from "./modules/pages/pages.routes";
import { authorsRoutes } from "./modules/authors/authors.routes";

export const app = Fastify({ logger: true });

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

app.register(authRoutes, { prefix: "/api/auth" });
app.register(postsRoutes, { prefix: "/api/posts" });
app.register(pagesRoutes, { prefix: "/api/pages" });
app.register(authorsRoutes, { prefix: "/api/authors" });
