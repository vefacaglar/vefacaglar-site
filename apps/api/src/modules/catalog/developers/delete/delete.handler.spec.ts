import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteDeveloperHandler } from "./delete.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("DeleteDeveloperHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: DeleteDeveloperHandler;

  beforeEach(() => {
    mockCatalog = { deleteDeveloper: vi.fn() };
    handler = new DeleteDeveloperHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call deleteDeveloper and return success", async () => {
    mockCatalog.deleteDeveloper.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "d-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.deleteDeveloper).toHaveBeenCalledWith("d-1");
    expect(result).toEqual({ success: true });
  });
});
