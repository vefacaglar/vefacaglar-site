import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdatePublisherHandler } from "./update.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("UpdatePublisherHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UpdatePublisherHandler;

  beforeEach(() => {
    mockCatalog = { updatePublisher: vi.fn() };
    handler = new UpdatePublisherHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass id and patch to updatePublisher", async () => {
    mockCatalog.updatePublisher.mockResolvedValue({
      id: "p-1",
      name: "CD Projekt",
      slug: "cd-projekt",
      countryCode: "PL",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRequest = {
      params: { id: "p-1" },
      body: { name: "CD Projekt", slug: "cd-projekt", countryCode: "PL" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.updatePublisher).toHaveBeenCalledWith("p-1", {
      name: "CD Projekt",
      slug: "cd-projekt",
      countryCode: "PL",
    });
    expect(result.id).toBe("p-1");
  });
});
