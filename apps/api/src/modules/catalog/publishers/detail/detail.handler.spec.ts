import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetPublisherHandler } from "./detail.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("GetPublisherHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: GetPublisherHandler;

  beforeEach(() => {
    mockCatalog = { getPublisherById: vi.fn() };
    handler = new GetPublisherHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should return mapped publisher", async () => {
    mockCatalog.getPublisherById.mockResolvedValue({
      id: "p-1",
      name: "CD Projekt",
      slug: "cd-projekt",
      countryCode: "PL",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      params: { id: "p-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.getPublisherById).toHaveBeenCalledWith("p-1");
    expect(result).toEqual({
      id: "p-1",
      name: "CD Projekt",
      slug: "cd-projekt",
      countryCode: "PL",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    });
  });
});
