import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdatePlatformHandler } from "./update.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("UpdatePlatformHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UpdatePlatformHandler;

  beforeEach(() => {
    mockCatalog = { updatePlatform: vi.fn() };
    handler = new UpdatePlatformHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass id and patch to updatePlatform", async () => {
    mockCatalog.updatePlatform.mockResolvedValue({
      id: "p-1",
      name: "PC",
      slug: "pc",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { name: "PC", slug: "pc" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.updatePlatform).toHaveBeenCalledWith("p-1", {
      name: "PC",
      slug: "pc",
    });
    expect(result.id).toBe("p-1");
  });
});
