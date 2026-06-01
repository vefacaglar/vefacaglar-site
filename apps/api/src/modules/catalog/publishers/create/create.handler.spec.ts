import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreatePublisherHandler } from "./create.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("CreatePublisherHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: CreatePublisherHandler;

  beforeEach(() => {
    mockCatalog = { createPublisher: vi.fn() };
    handler = new CreatePublisherHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should call createPublisher with name/slug/countryCode and map the result", async () => {
    mockCatalog.createPublisher.mockResolvedValue({
      id: "p-1",
      name: "CD Projekt",
      slug: "cd-projekt",
      countryCode: "PL",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      body: { name: "CD Projekt", slug: "cd-projekt", countryCode: "PL" },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.createPublisher).toHaveBeenCalledWith({
      name: "CD Projekt",
      slug: "cd-projekt",
      countryCode: "PL",
    });
    expect(result.countryCode).toBe("PL");
  });

  it("should map null countryCode and updatedAt to null", async () => {
    mockCatalog.createPublisher.mockResolvedValue({
      id: "p-2",
      name: "X",
      slug: "x",
      countryCode: null,
      createdAt: new Date(),
      updatedAt: null,
    });

    const mockRequest = {
      body: { name: "X", slug: "x" },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);
    expect(result.countryCode).toBeNull();
    expect(result.updatedAt).toBeNull();
  });
});
