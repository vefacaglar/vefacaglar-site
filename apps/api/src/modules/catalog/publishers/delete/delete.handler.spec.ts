import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeletePublisherHandler } from "./delete.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("DeletePublisherHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: DeletePublisherHandler;

  beforeEach(() => {
    mockCatalog = { deletePublisher: vi.fn() };
    handler = new DeletePublisherHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call deletePublisher and return success", async () => {
    mockCatalog.deletePublisher.mockResolvedValue(undefined);

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.deletePublisher).toHaveBeenCalledWith("p-1");
    expect(result).toEqual({ success: true });
  });
});
