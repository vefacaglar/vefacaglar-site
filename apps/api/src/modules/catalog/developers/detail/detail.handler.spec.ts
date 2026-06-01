import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetDeveloperHandler } from "./detail.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("GetDeveloperHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: GetDeveloperHandler;

  beforeEach(() => {
    mockCatalog = { getDeveloperById: vi.fn() };
    handler = new GetDeveloperHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should return mapped developer response", async () => {
    mockCatalog.getDeveloperById.mockResolvedValue({
      id: "d-1",
      name: "CD Projekt Red",
      slug: "cd-projekt-red",
      countryCode: "PL",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "d-1" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.getDeveloperById).toHaveBeenCalledWith("d-1");
    expect(result).toEqual({
      id: "d-1",
      name: "CD Projekt Red",
      slug: "cd-projekt-red",
      countryCode: "PL",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("should map null updatedAt to null", async () => {
    mockCatalog.getDeveloperById.mockResolvedValue({
      id: "d-2",
      name: "X",
      slug: "x",
      countryCode: null,
      createdAt: new Date(),
      updatedAt: null,
    });

    const mockRequest = {
      params: { id: "d-2" },
    } as unknown as FastifyRequest<{ Params: { id: string } }>;

    const result = await handler.handle(mockRequest);
    expect(result.updatedAt).toBeNull();
  });
});
