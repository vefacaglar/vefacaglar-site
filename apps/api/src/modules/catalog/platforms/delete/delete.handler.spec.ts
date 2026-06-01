import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeletePlatformHandler } from "./delete.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("DeletePlatformHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: DeletePlatformHandler;

  beforeEach(() => {
    mockCatalog = { deletePlatform: vi.fn() };
    handler = new DeletePlatformHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call deletePlatform and return success", async () => {
    mockCatalog.deletePlatform.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.deletePlatform).toHaveBeenCalledWith("p-1");
    expect(result).toEqual({ success: true });
  });
});
