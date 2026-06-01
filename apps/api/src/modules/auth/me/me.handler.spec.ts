import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { MeHandler } from "./me.handler";
import { FastifyRequest } from "fastify";

describe("MeHandler", () => {
  let handler: MeHandler;

  beforeEach(() => {
    handler = new MeHandler();
  });

  it("should successfully return formatted user session details from fastify request context", async () => {
    const mockRequest = {
      user: {
        id: "user-111",
        email: "vefa@example.com",
        displayName: "Vefa Çağlar",
        role: "admin",
        passwordHash: "secret_hash",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as FastifyRequest;

    const result = await handler.handle(mockRequest);

    expect(result).toEqual({
      user: {
        id: "user-111",
        email: "vefa@example.com",
        displayName: "Vefa Çağlar",
        role: "admin",
      },
    });
  });
});
