import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { HttpError, UnauthorizedError } from "../../shared/http-errors";

const authenticate = vi.hoisted(() => vi.fn());

vi.mock("../../container", () => ({ container: { resolve: () => ({ authenticate }) } }));

import { registerAuthDecorators } from "./auth.plugin";

describe("auth decorators", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    registerAuthDecorators(app);
    app.setErrorHandler((err, _request, reply) =>
      reply.status(err instanceof HttpError ? err.statusCode : 500).send({ message: err.message }),
    );
    app.get("/user", { preHandler: app.requireAuth }, async () => ({ ok: true }));
    app.get("/admin", { preHandler: app.requireAdmin }, async () => ({ ok: true }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  it.each(["/user", "/admin"])("answers 401 on %s when the session is rejected", async (url) => {
    authenticate.mockRejectedValue(new UnauthorizedError("Unauthorized"));

    const res = await app.inject({ url });

    expect(res.statusCode).toBe(401);
  });

  it.each(["/user", "/admin"])("answers 500, not 401, on %s when the session lookup fails", async (url) => {
    authenticate.mockRejectedValue(new Error("connection terminated"));

    const res = await app.inject({ url });

    expect(res.statusCode).toBe(500);
  });

  it("answers 401 on an admin route for a non-admin user", async () => {
    authenticate.mockResolvedValue({ user: { role: "user" }, session: {} });

    const res = await app.inject({ url: "/admin" });

    expect(res.statusCode).toBe(401);
  });

  it("lets a valid admin session through", async () => {
    authenticate.mockResolvedValue({ user: { role: "admin" }, session: {} });

    const res = await app.inject({ url: "/admin" });

    expect(res.statusCode).toBe(200);
  });
});
