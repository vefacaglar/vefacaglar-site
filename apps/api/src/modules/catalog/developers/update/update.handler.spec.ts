import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateDeveloperHandler } from "./update.handler";
import { GameCatalogService } from "../../catalog.service";
import { FastifyRequest } from "fastify";

describe("UpdateDeveloperHandler", () => {
  let mockCatalog: Record<string, any>;
  let handler: UpdateDeveloperHandler;

  beforeEach(() => {
    mockCatalog = { updateDeveloper: vi.fn() };
    handler = new UpdateDeveloperHandler(mockCatalog as unknown as GameCatalogService);
  });

  it("should pass id and partial data to catalog and map the result", async () => {
    mockCatalog.updateDeveloper.mockResolvedValue({
      id: "d-1",
      name: "Renamed",
      slug: "renamed",
      countryCode: "US",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const mockRequest = {
      params: { id: "d-1" },
      body: { name: "Renamed", slug: "renamed", countryCode: "US" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    const result = await handler.handle(mockRequest);

    expect(mockCatalog.updateDeveloper).toHaveBeenCalledWith("d-1", {
      name: "Renamed",
      slug: "renamed",
      countryCode: "US",
    });
    expect(result).toEqual({
      id: "d-1",
      name: "Renamed",
      slug: "renamed",
      countryCode: "US",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("should propagate repository errors", async () => {
    mockCatalog.updateDeveloper.mockRejectedValue(new Error("db down"));

    const mockRequest = {
      params: { id: "d-1" },
      body: { name: "X" },
    } as unknown as FastifyRequest<{ Params: any; Body: any }>;

    await expect(handler.handle(mockRequest)).rejects.toThrow("db down");
  });
});
