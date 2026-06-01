import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreatePlatformHandler } from "./create.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("CreatePlatformHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: CreatePlatformHandler;

  beforeEach(() => {
    mockCatalog = { createPlatform: vi.fn() };
    handler = new CreatePlatformHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call createPlatform and map the result", async () => {
    mockCatalog.createPlatform.mockResolvedValue({
      id: "p-1",
      name: "PC",
      slug: "pc",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      body: { name: "PC", slug: "pc" },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.createPlatform).toHaveBeenCalledWith({ name: "PC", slug: "pc" });
    expect(result).toEqual({
      id: "p-1",
      name: "PC",
      slug: "pc",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
