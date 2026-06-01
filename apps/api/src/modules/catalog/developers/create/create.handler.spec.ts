import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateDeveloperHandler } from "./create.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("CreateDeveloperHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: CreateDeveloperHandler;

  beforeEach(() => {
    mockCatalog = { createDeveloper: vi.fn() };
    handler = new CreateDeveloperHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass name/slug/countryCode to catalog and map the result", async () => {
    mockCatalog.createDeveloper.mockResolvedValue({
      id: "d-1",
      name: "CD Projekt Red",
      slug: "cd-projekt-red",
      countryCode: "PL",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: null,
    });

    const mockRequest = {
      body: { name: "CD Projekt Red", slug: "cd-projekt-red", countryCode: "PL" },
    } as unknown as FastifyRequest<{ Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.createDeveloper).toHaveBeenCalledWith({
      name: "CD Projekt Red",
      slug: "cd-projekt-red",
      countryCode: "PL",
    });
    expect(result).toEqual({
      id: "d-1",
      name: "CD Projekt Red",
      slug: "cd-projekt-red",
      countryCode: "PL",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: null,
    });
  });

  it("should map null updatedAt to null in response", async () => {
    mockCatalog.createDeveloper.mockResolvedValue({
      id: "d-2",
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
    expect(result.updatedAt).toBeNull();
    expect(result.countryCode).toBeNull();
  });
});
