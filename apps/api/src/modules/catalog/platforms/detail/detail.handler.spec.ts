import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPlatformHandler } from "./detail.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("GetPlatformHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: GetPlatformHandler;

  beforeEach(() => {
    mockCatalog = { getPlatformById: vi.fn() };
    handler = new GetPlatformHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should return mapped platform", async () => {
    mockCatalog.getPlatformById.mockResolvedValue({
      id: "p-1",
      name: "PC",
      slug: "pc",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.getPlatformById).toHaveBeenCalledWith("p-1");
    expect(result).toEqual({
      id: "p-1",
      name: "PC",
      slug: "pc",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
